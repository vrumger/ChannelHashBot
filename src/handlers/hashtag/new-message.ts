import { HashtagHandler, sendMessage } from './utils';
import { GrammyError } from 'grammy';
import Group from '../../models/group';
import { Group as IGroup } from '../../typings/db';
import Message from '../../models/message';

export const handleNewMessage: HashtagHandler = async (
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

    let chat: IGroup | null;
    try {
        chat = await Group.findOne({ chat_id: ctx.msg.chat.id });
    } catch (err) {
        console.error(err);
        return;
    }

    if (!chat || !chat.tags) {
        return;
    }

    const sentChannels: number[] = [];

    for (const tag of tags) {
        if (!chat.tags[tag]) {
            continue;
        }

        // Convert to array for backwards compatibility
        if (!Array.isArray(chat.tags[tag])) {
            chat.tags[tag] = [chat.tags[tag] as unknown as number];
        }

        for (const channelID of chat.tags[tag]) {
            if (sentChannels.includes(channelID)) {
                continue;
            }

            try {
                const sentMessage = await sendMessage({
                    ctx,
                    chat,
                    channelID,
                    message,
                    text,
                    entities,
                });

                sentChannels.push(channelID);
                await new Message({
                    chat_id: ctx.msg.chat.id,
                    message_id: message.message_id,
                    channel_id: channelID,
                    channel_message_id: sentMessage.message_id,
                }).save();
            } catch (error) {
                if (
                    !(error instanceof GrammyError) &&
                    // TODO:
                    // @ts-expect-error `Object is of type 'unknown'`
                    ![400, 403].includes(error.error_code)
                ) {
                    throw error;
                }

                if (chat.tags[tag].length === 1) {
                    delete chat.tags[tag];
                } else {
                    chat.tags[tag].splice(chat.tags[tag].indexOf(channelID), 1);
                }

                chat.markModified('tags');
            }
        }
    }

    await chat.save();
};
