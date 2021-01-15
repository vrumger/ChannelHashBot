import { GroupTags, Channel as IChannel, Group as IGroup } from '../typings/db';
import Channel from '../models/channel';
import { Composer } from 'telegraf';
import CustomContext from '../context';
import Group from '../models/group';
import { deunionize } from '../utils';

export const watch = Composer.command<CustomContext>(
    'watch',
    Composer.groupChat(
        Composer.admin(async ctx => {
            const { message_id, chat, from, text, entities } = deunionize(ctx.message);

            const tags = (entities || [])
                .filter(entity => entity.type === 'hashtag')
                .map(entity => text!.slice(entity.offset, entity.offset + entity.length))
                .join(', ');

            let channels: IChannel[] | null;
            try {
                channels = await Channel.find({
                    admins: { $elemMatch: { $eq: from.id } },
                });
            } catch (err) {
                console.error(err);
                ctx.reply('There was an error.');
                return;
            }

            if (channels.length === 0) {
                return ctx.reply('You need to add a channel first.');
            }

            ctx.reply(`Choose a chat for the following tags:\n${tags}`, {
                reply_to_message_id: message_id,
                reply_markup: {
                    inline_keyboard: [
                        ...channels.map(channel => [
                            {
                                text: channel.title,
                                callback_data: `${from.id}:${chat.id}:${channel.chat_id}`,
                            },
                        ]),
                        [
                            {
                                text: 'My Private Messages 🗨',
                                callback_data: `${from.id}:${chat.id}:${from.id}`,
                            },
                        ],
                        [
                            {
                                text: 'Done 👍',
                                callback_data: `${from.id}:done`,
                            },
                        ],
                    ],
                },
            });
        }),
    ),
);

export const addChannel = Composer.action<CustomContext>(/^(\d+):(-\d+):(-?\d+)$/, async ctx => {
    const from = Number(ctx.match[1]);
    const group = Number(ctx.match[2]);
    const channel = Number(ctx.match[3]);

    if (from !== ctx.from?.id) return ctx.answerCbQuery('😒');
    if (!ctx.callbackQuery.message) return;

    const { text, entities } = deunionize(ctx.callbackQuery.message);

    const hashtags = (entities || [])
        .filter(entity => entity.type === 'hashtag')
        .map(entity => (text ? text.slice(entity.offset + 1, entity.offset + entity.length) : ''));

    let chat: IGroup | null;
    try {
        chat = await Group.findOne({ chat_id: group });
    } catch (err) {
        console.log(err);
        ctx.answerCbQuery('🚫');
        return;
    }

    if (!chat) {
        chat = new Group({ chat_id: group, tags: {} });
    } else if (!chat.tags) {
        chat.tags = {};
    }

    const tagsObject = hashtags.reduce(
        (tags: GroupTags, hashtag) => {
            if (!tags[hashtag]) {
                tags[hashtag] = [];
            } else if (!Array.isArray(tags[hashtag])) {
                // Convert to array for backwards compatibility
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                tags[hashtag] = [tags[hashtag]];
            }

            // Append and filter duplicates
            tags[hashtag] = [...new Set(tags[hashtag].concat(channel))];
            return tags;
        },
        { ...chat.tags },
    );

    chat.tags = tagsObject;
    await chat.save();

    ctx.answerCbQuery('👍');
});

export const finishAddingChannels = Composer.action<CustomContext>(/^(\d+):done$/, ctx => {
    if (!('message' in ctx.callbackQuery) || !ctx.callbackQuery.message) return;
    const message_id = deunionize(ctx.callbackQuery.message).reply_to_message?.message_id;
    const from = Number(ctx.match[1]);

    if (from !== ctx.from?.id) return ctx.answerCbQuery('😒');

    ctx.answerCbQuery('👍');
    ctx.deleteMessage();

    if (message_id) {
        ctx.deleteMessage(message_id).catch(() => {
            // Ignore error
        });
    }
});
