const adminMiddleware = require(`../middleware/admin`);

module.exports = (bot, db) => {
    bot.command(`watch`, adminMiddleware, ctx => {
        if (!ctx.chat.type.includes(`group`)) return;

        const { message_id, text, entities } = ctx.message;

        const tags = (entities || [])
            .filter(entity => entity.type === `hashtag`)
            .map(entity =>
                text.slice(entity.offset, entity.offset + entity.length)
            )
            .join(`, `);

        db.channels.find(
            { admins: { $elemMatch: ctx.from.id } },
            (err, channels) => {
                if (err) {
                    console.error(err);
                    ctx.reply(`There was an error.`);
                    return;
                }

                if (channels.length === 0) {
                    return ctx.reply(`You need to add a channel first.`);
                }

                ctx.reply(`Choose a chat for the following tags:\n${tags}`, {
                    reply_to_message_id: message_id,
                    reply_markup: {
                        inline_keyboard: [
                            ...channels.map(channel => [
                                {
                                    text: channel.title,
                                    callback_data: `${ctx.from.id}:${
                                        ctx.chat.id
                                    }:${channel.chat_id}`,
                                },
                            ]),
                            [
                                {
                                    text: `My Private Messages 🗨`,
                                    callback_data: `${ctx.from.id}:${
                                        ctx.chat.id
                                    }:${ctx.from.id}`,
                                },
                            ],
                            [
                                {
                                    text: `Done 👍`,
                                    callback_data: `${ctx.from.id}:done`,
                                },
                            ],
                        ],
                    },
                });
            }
        );
    });

    bot.action(/^(\d+):(-\d+):(-?\d+)$/, ctx => {
        const from = Number(ctx.match[1]);
        const group = Number(ctx.match[2]);
        const channel = Number(ctx.match[3]);

        if (from !== ctx.from.id) return ctx.answerCbQuery(`😒`);

        const { text, entities } = ctx.callbackQuery.message;

        const tags = (entities || [])
            .filter(entity => entity.type === `hashtag`)
            .map(entity =>
                text.slice(entity.offset + 1, entity.offset + entity.length)
            );

        db.groups.findOne({ chat_id: group }, (err, chat) => {
            if (err) {
                console.log(err);
                ctx.answerCbQuery(`🚫`);
                return;
            }

            if (!chat) {
                chat = { tags: {} };
            } else if (!chat.tags) {
                chat.tags = {};
            }

            const tagsObject = tags.reduce((tags, tag) => {
                if (!tags[tag]) {
                    tags[tag] = [];
                } else if (!Array.isArray(tags[tag])) {
                    // Convert to array for backwards compatibility
                    tags[tag] = [tags[tag]];
                }

                // Append and filter duplicates
                tags[tag] = [...new Set(tags[tag].concat(channel))];
                return tags;
            }, chat.tags);

            db.groups.update(
                { chat_id: group },
                { $set: { tags: tagsObject } },
                { upsert: true }
            );

            ctx.answerCbQuery(`👍`);
        });
    });

    bot.action(/^(\d+):done$/, ctx => {
        const { message_id } = ctx.callbackQuery.message.reply_to_message;
        const from = Number(ctx.match[1]);

        if (from !== ctx.from.id) return ctx.answerCbQuery(`😒`);

        ctx.answerCbQuery(`👍`);
        ctx.deleteMessage();
        ctx.deleteMessage(message_id).catch(() => {});
    });
};
