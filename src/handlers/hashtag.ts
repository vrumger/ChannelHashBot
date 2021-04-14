// TODO: cleanup

import { ExtraAudio, ExtraDocument, ExtraPhoto, ExtraVideo } from 'telegraf/typings/telegram-types';
import { Group as IGroup, Message as IMessage } from '../typings/db';
import { InlineKeyboardMarkup, MessageEntity, ParseMode, Message as TMessage } from 'typegram';
import { deunionize, getEntities, getText } from '../utils';
import Channel from '../models/channel';
import { Composer } from 'telegraf';
import CustomContext from '../context';
import Group from '../models/group';
import Message from '../models/message';
import textToHtml from '@youtwitface/text-to-html';

interface GetReplyMarkupOptions {
    chat: IGroup;
    directLink: string;
    message_id: number;
    plus?: number;
    minus?: number;
}

const getReplyMarkup = (
    ctx: CustomContext,
    { chat, directLink, message_id, plus = 0, minus = 0 }: GetReplyMarkupOptions,
): InlineKeyboardMarkup => {
    const inlineKeyboard: InlineKeyboardMarkup['inline_keyboard'] = [];

    if (chat.settings?.likes) {
        inlineKeyboard.push(ctx.formatLikeKeyboard(plus, minus));
    }

    if (chat.settings?.link) {
        inlineKeyboard.push([
            {
                text: 'Go to message',
                url: `https://t.me/${directLink}/${message_id}`,
            },
        ]);
    }

    return {
        inline_keyboard: inlineKeyboard,
    };
};

const getMessage = (ctx: CustomContext) => {
    if (!ctx.message && !ctx.editedMessage) return;
    const message = deunionize(ctx.message ?? ctx.editedMessage);
    const { forward_date, reply_to_message: reply } = deunionize(message);

    // Use `forward_date` because it's always there for every type of forward
    if (forward_date) return;

    let entities = message.entities || message.caption_entities || [];
    let text = message.text || message.caption || '';

    const hashtagEntities = entities.filter(entity => entity.type === 'hashtag');

    const tags = hashtagEntities
        .filter(entity => entity.type === 'hashtag')
        .map(entity => text.slice(entity.offset + 1, entity.offset + entity.length).toLowerCase());

    const untaggedText = hashtagEntities
        .reduce((res, entity) => res.slice(0, entity.offset) + res.slice(entity.offset + entity.length), text)
        .trim();

    const messageToSend = deunionize(untaggedText !== '' || !reply ? message : reply);
    text = messageToSend.text || messageToSend.caption || '';
    entities = messageToSend.entities || messageToSend.caption_entities || [];

    return {
        message: messageToSend,
        text,
        entities,
        tags,
    };
};

const sendMessage = async (
    ctx: CustomContext,
    chat: IGroup,
    channelID: number,
    message: TMessage,
    text: string,
    entities: MessageEntity[],
) => {
    // Use `!== false` in case it's `undefined`
    if (!chat.settings || chat.settings.forwards !== false) {
        return await ctx.telegram.forwardMessage(channelID, message.chat.id, message.message_id);
    }

    const channel = await Channel.findOne({ chat_id: channelID });
    const parsedMessage: string = textToHtml(text, entities);
    const chatId = message.chat.id.toString().slice(4);
    const directLink = 'username' in message.chat && message.chat.username ? message.chat.username : `c/${chatId}`;

    const options: ExtraAudio | ExtraDocument | ExtraPhoto | ExtraVideo = {
        reply_markup: getReplyMarkup(ctx, {
            chat,
            directLink,
            message_id: message.message_id,
        }),
        caption: parsedMessage,
        parse_mode: 'HTML',
    };

    let sentMessage;

    if ('audio' in message) {
        sentMessage = await ctx.telegram.sendAudio(channelID, message.audio.file_id, options);
    } else if ('document' in message) {
        sentMessage = await ctx.telegram.sendDocument(channelID, message.document.file_id, options);
    } else if ('photo' in message) {
        if (chat.settings.comments) {
            await ctx.createComment!(parsedMessage, channel?.admins || [], options);
        }

        const photos = [...message.photo];
        const fileId = photos.pop()!.file_id;

        sentMessage = await ctx.telegram.sendPhoto(channelID, fileId, options);
    } else if ('video' in message) {
        sentMessage = await ctx.telegram.sendVideo(channelID, message.video.file_id, options);
    } else {
        if (chat.settings.comments) {
            await ctx.createComment!(parsedMessage, channel?.admins || [], options);
        }

        sentMessage = await ctx.telegram.sendMessage(channelID, parsedMessage, options);
    }

    return sentMessage;
};

const handler = async (ctx: CustomContext) => {
    if (!ctx.chat) return;

    const _message = getMessage(ctx);
    if (!_message) return;

    const { message, text, entities, tags } = _message;

    let chat: IGroup | null;
    try {
        chat = await Group.findOne({ chat_id: ctx.chat.id });
    } catch (err) {
        console.error(err);
        return;
    }

    if (!chat || !chat.tags) return;

    const sentChannels: number[] = [];

    for (const tag of tags) {
        if (!chat.tags[tag]) {
            continue;
        }

        // Convert to array for backwards compatibility
        if (!Array.isArray(chat.tags[tag])) {
            chat.tags[tag] = [(chat.tags[tag] as unknown) as number];
        }

        for (const channel of chat.tags[tag]) {
            if (sentChannels.includes(channel)) {
                continue;
            }

            const sentMessage = await sendMessage(ctx, chat, channel, message, text, entities);

            sentChannels.push(channel);
            await new Message({
                chat_id: ctx.chat.id,
                message_id: message.message_id,
                channel_id: channel,
                channel_message_id: sentMessage.message_id,
            }).save();
        }
    }
};

export const hashtag = Composer.optional<CustomContext>(ctx => {
    const { message } = ctx;
    if (message === undefined) return false;

    const text = getText(message);
    const entities = getEntities(message);
    if (text === undefined) return false;
    return entities.some(entity => entity.type === 'hashtag');
}, handler);

export const editedMessage = Composer.on<CustomContext, 'edited_message'>(
    'edited_message',
    Composer.groupChat(async ctx => {
        const _message = getMessage(ctx);
        if (!_message) return;
        const { message, text, entities } = _message;

        let channelMessages: IMessage[] | null;
        try {
            channelMessages = await Message.find({
                chat_id: ctx.editedMessage.chat.id,
                message_id: message.message_id,
            });
        } catch (err) {
            console.error(err);
            return;
        }

        if (!channelMessages.length) {
            const entities = getEntities(ctx.editedMessage);
            if (entities.some(entity => entity.type === 'hashtag')) {
                await handler(ctx);
            }

            return;
        }

        let chat: IGroup | null;
        try {
            chat = await Group.findOne({ chat_id: ctx.editedMessage.chat.id });
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
                ctx.telegram.forwardMessage(channelMessage.channel_id, ctx.editedMessage.chat.id, message.message_id);

                ctx.telegram.deleteMessage(channelMessage.channel_id, channelMessage.channel_message_id).catch(() => {
                    // Ignore error
                });

                continue;
            }

            const parsedMessage: string = textToHtml(text, entities);
            const chatId = ctx.editedMessage.chat.id.toString().slice(4);
            const directLink =
                'username' in ctx.editedMessage.chat && ctx.editedMessage.chat.username
                    ? ctx.editedMessage.chat.username
                    : `c/${chatId}`;

            const [plus, minus] = await ctx.countLikes(ctx.editedMessage.chat.id, channelMessage.channel_message_id);
            const messageOptions = {
                reply_markup: getReplyMarkup(ctx, {
                    chat,
                    directLink,
                    message_id: message.message_id,
                    plus,
                    minus,
                }),
                parse_mode: 'HTML' as ParseMode,
            };

            let messagePromise: Promise<TMessage | boolean | void> = Promise.resolve();
            if (message.audio || message.document || message.photo || message.video) {
                messagePromise = ctx.telegram.editMessageCaption(
                    channelMessage.channel_id,
                    channelMessage.channel_message_id,
                    undefined,
                    parsedMessage,
                    messageOptions,
                );
            } else {
                messagePromise = ctx.telegram.editMessageText(
                    channelMessage.channel_id,
                    channelMessage.channel_message_id,
                    undefined,
                    parsedMessage,
                    messageOptions,
                );
            }

            messagePromise.catch(async err => {
                if (err.description === 'Bad Request: message to edit not found') {
                    const sentMessage = await sendMessage(
                        ctx,
                        // TODO: figure out why TypeScript is complaining
                        chat!,
                        channelMessage.channel_id,
                        message,
                        parsedMessage,
                        [],
                    );

                    await new Message({
                        chat_id: ctx.editedMessage.chat.id,
                        message_id: message.message_id,
                        channel_id: channelMessage.channel_id,
                        channel_message_id: sentMessage.message_id,
                    }).save();
                } else {
                    console.log(err);
                }
            });
        }
    }),
);
