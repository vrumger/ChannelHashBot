import { HashtagHandler, sendMessage } from './utils';
import { GrammyError } from 'grammy';
import Group from '../../models/group';
import { Group as IGroup } from '../../typings/db';
import Message from '../../models/message';
import { lowerCaseObject } from '../../utils';

export const handleNewMessage: HashtagHandler = async (
    ctx,
    message,
    entities,
    text,
    textIsCaption,
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
    const [chatTags, tagKeyMap] = lowerCaseObject(chat.tags);

    for (const tag of tags) {
        if (!chatTags[tag]) {
            continue;
        }

        // Convert to array for backwards compatibility
        if (!Array.isArray(chatTags[tag])) {
            chatTags[tag] = [chatTags[tag] as unknown as number];
            chat.tags[tagKeyMap[tag]] = chatTags[tag];
        }

        for (const channelID of chatTags[tag]) {
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
                    textIsCaption,
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

                if (chat.tags[tagKeyMap[tag]].length === 1) {
                    delete chat.tags[tagKeyMap[tag]];
                } else {
                    chat.tags[tagKeyMap[tag]].splice(
                        chat.tags[tagKeyMap[tag]].indexOf(channelID),
                        1,
                    );
                }

                chat.markModified('tags');
            }
        }
    }

    await chat.save();
};
