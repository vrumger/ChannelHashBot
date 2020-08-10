import { Channel, ChatTags } from '../typings/db';
import { Database, TBot } from '../typings';
import adminMiddleware from '../middleware/admin';

export default (bot: TBot, db: Database): void => {
    bot.command('watch', adminMiddleware(), ctx => {
        if (!ctx.chat!.type.includes('group')) return;

        const { message_id, text, entities } = ctx.message!;

        const tags = (entities || [])
            .filter(entity => entity.type === 'hashtag')
            .map(entity =>
                text!.slice(entity.offset, entity.offset + entity.length),
            )
            .join(', ');

        db.channels.find(
            { admins: { $elemMatch: ctx.from!.id } },
            (err: Error, channels: Channel[]) => {
                if (err) {
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
                                    callback_data: `${ctx.from!.id}:${
                                        ctx.chat!.id
                                    }:${channel.chat_id}`,
                                },
                            ]),
                            [
                                {
                                    text: 'My Private Messages 🗨',
                                    callback_data: `${ctx.from!.id}:${
                                        ctx.chat!.id
                                    }:${ctx.from!.id}`,
                                },
                            ],
                            [
                                {
                                    text: 'Done 👍',
                                    callback_data: `${ctx.from!.id}:done`,
                                },
                            ],
                        ],
                    },
                });
            },
        );
    });

    bot.action(/^(\d+):(-\d+):(-?\d+)$/, ctx => {
        const from = Number(ctx.match![1]);
        const group = Number(ctx.match![2]);
        const channel = Number(ctx.match![3]);

        if (from !== ctx.from!.id) return ctx.answerCbQuery('😒');
        if (!ctx.callbackQuery!.message) return;

        const { text, entities } = ctx.callbackQuery!.message!;

        const hashtags = (entities || [])
            .filter(entity => entity.type === 'hashtag')
            .map(entity =>
                text!.slice(entity.offset + 1, entity.offset + entity.length),
            );

        db.groups.findOne({ chat_id: group }, (err, chat) => {
            if (err) {
                console.log(err);
                ctx.answerCbQuery('🚫');
                return;
            }

            if (!chat) {
                chat = { chat_id: group, tags: {} };
            } else if (!chat.tags) {
                chat.tags = {};
            }

            const tagsObject = hashtags.reduce((tags: ChatTags, hashtag) => {
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
            }, chat.tags!);

            db.groups.update(
                { chat_id: group },
                { $set: { tags: tagsObject } },
                { upsert: true },
            );

            ctx.answerCbQuery('👍');
        });
    });

    bot.action(/^(\d+):done$/, ctx => {
        const message_id = ctx.callbackQuery!.message?.reply_to_message
            ?.message_id;
        const from = Number(ctx.match![1]);

        if (from !== ctx.from!.id) return ctx.answerCbQuery('😒');

        ctx.answerCbQuery('👍');
        ctx.deleteMessage();

        if (message_id) {
            ctx.deleteMessage(message_id).catch(() => {
                // Ignore error
            });
        }
    });
};
