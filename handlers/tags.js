const adminMiddleware = require(`../middleware/admin`);

module.exports = (bot, db) => {
    const getChannelTitle = chat_id => {
        return new Promise((resolve, reject) => {
            if (chat_id >= 0) {
                // TODO: cache names
                return bot.telegram
                    .getChat(chat_id)
                    .then(user =>
                        resolve(
                            `${user.first_name} ${user.last_name || ``}`.trim()
                        )
                    );
            }

            db.channels.findOne({ chat_id }, (err, channel) => {
                if (err) reject(err);
                else resolve(channel.title);
            });
        });
    };

    bot.command(`tags`, adminMiddleware, ctx => {
        if (!ctx.chat.type.includes(`group`)) return;

        db.groups.findOne({ chat_id: ctx.chat.id }, async (err, chat) => {
            if (err) {
                console.error(err);
                ctx.reply(`There was an error.`);
                return;
            }

            if (!chat) {
                chat = { tags: {} };
            } else if (!chat.tags) {
                chat.tags = {};
            }

            const channels = await Promise.all(
                Object.keys(chat.tags).map(tag =>
                    Promise.all(
                        // Convert to array for backwards compatibility
                        (Array.isArray(chat.tags[tag])
                            ? chat.tags[tag]
                            : [chat.tags[tag]]
                        ).map(channel => getChannelTitle(channel))
                    )
                )
            );

            ctx.reply(
                Object.keys(chat.tags)
                    .map((tag, i) => `» #${tag} → ${channels[i].join(`, `)}`)
                    .join(`\n`) || `No tags in this chat.`
            );
        });
    });
};
