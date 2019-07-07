const adminMiddleware = require(`../middleware/admin`);

module.exports = (bot, db) => {
    bot.command(`watch`, adminMiddleware, ctx => {
        if (!ctx.chat.type.includes(`group`)) return;

        const { text, entities } = ctx.message;

        const tags = (entities || [])
            .filter(entity => entity.type === `hashtag`)
            .map(entity =>
                text.slice(entity.offset, entity.offset + entity.length)
            )
            .join(` `);

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
                    reply_markup: {
                        inline_keyboard: channels.map(channel => [
                            {
                                text: channel.title,
                                callback_data: `${ctx.from.id}:${ctx.chat.id}:${
                                    channel.chat_id
                                }`,
                            },
                        ]),
                    },
                });
            }
        );
    });

    bot.action(/^(\d+):(-\d+):(-\d+)$/, ctx => {
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

        let tagsObject = tags.reduce(
            (tags, tag) => ({ ...tags, [tag]: channel }),
            {}
        );

        db.groups.findOne({ chat_id: group }, (err, chat) => {
            if (err) {
                console.log(err);
                ctx.answerCbQuery(`🚫`);
                return;
            }

            if (chat !== null) {
                tagsObject = {
                    ...chat.tags,
                    ...tagsObject,
                };
            }

            db.groups.update(
                { chat_id: group },
                { $set: { tags: tagsObject } },
                { upsert: true }
            );

            ctx.answerCbQuery(`👍`);
            ctx.editMessageText(
                `The following tags have been saved:\n${tags.map(
                    tag => `#${tag}`
                )}`
            );
        });
    });
};
