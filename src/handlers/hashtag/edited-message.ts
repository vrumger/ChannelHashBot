import { HashtagHandler, getReplyMarkup, sendMessage } from './utils';
import { Group as IGroup, Message as IMessage } from '../../typings/db';
import { Message as TMessage, Update } from '@grammyjs/types';
import Group from '../../models/group';
import Message from '../../models/message';
import { countLikes } from '../../utils';
import { handleNewMessage } from './new-message';

export const handleEditedMessage: HashtagHandler = async (
    ctx,
    message,
    entities,
    text,
    hashtagEntities,
    tags,
) => {
    if (!ctx.msg) {
        return;
    }

    let channelMessages: IMessage[];
    try {
        channelMessages = await Message.find({
            chat_id: ctx.msg.chat.id,
            message_id: message.message_id,
        });
    } catch (err) {
        if (err instanceof Error) {
            console.error(err.stack);
        } else {
            console.error(err);
        }

        return;
    }

    if (!channelMessages.length) {
        if (hashtagEntities.length > 0) {
            await handleNewMessage(
                ctx,
                message,
                entities,
                text,
                hashtagEntities,
                tags,
            );
        }

        return;
    }

    let chat: IGroup | null;
    try {
        chat = await Group.findOne({ chat_id: ctx.msg.chat.id });
    } catch (err) {
        console.error(err);
        return;
    }

    if (!chat) {
        return;
    }

    for (const channelMessage of channelMessages) {
        // Use `!== false` in case it's `undefined`
        if (!chat.settings || chat.settings.forwards !== false) {
            await ctx.api.forwardMessage(
                channelMessage.channel_id,
                ctx.msg.chat.id,
                message.message_id,
            );
            await ctx.api
                .deleteMessage(
                    channelMessage.channel_id,
                    channelMessage.channel_message_id,
                )
                .catch(() => {
                    // Ignore error
                });

            continue;
        }

        const chatId = ctx.msg.chat.id.toString().slice(4);
        const directLink =
            'username' in ctx.msg.chat && ctx.msg.chat.username
                ? ctx.msg.chat.username
                : `c/${chatId}`;

        const [plus, minus] = await countLikes(
            ctx.msg.chat.id,
            channelMessage.channel_message_id,
        );
        const replyMarkup = getReplyMarkup({
            chat,
            directLink,
            message_id: message.message_id,
            plus,
            minus,
        });

        let messagePromise: Promise<
            | (Update.Edited & TMessage.TextMessage)
            | (Update.Edited & TMessage.CaptionableMessage)
            | true
            | void
        > = Promise.resolve();
        if (
            message.audio ||
            message.document ||
            message.photo ||
            message.video
        ) {
            messagePromise = ctx.api.editMessageCaption(
                channelMessage.channel_id,
                channelMessage.channel_message_id,
                {
                    caption: text,
                    caption_entities: entities,
                    reply_markup: replyMarkup,
                },
            );
        } else {
            messagePromise = ctx.api.editMessageText(
                channelMessage.channel_id,
                channelMessage.channel_message_id,
                text,
                {
                    entities,
                    reply_markup: replyMarkup,
                },
            );
        }

        messagePromise.catch(async err => {
            if (err.description === 'Bad Request: message to edit not found') {
                const sentMessage = await sendMessage({
                    ctx,
                    chat: chat!,
                    channelID: channelMessage.channel_id,
                    message,
                    text,
                    entities,
                });

                await new Message({
                    chat_id: ctx.msg!.chat.id,
                    message_id: message.message_id,
                    channel_id: channelMessage.channel_id,
                    channel_message_id: sentMessage.message_id,
                }).save();
            } else {
                console.error(err);
            }
        });
    }
};
