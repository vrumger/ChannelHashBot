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
                            `${user.first_name} ${user.last_name || ``}`.trim(),
                        ),
                    );
            }

            db.channels.findOne({ chat_id }, (err, channel) => {
                if (err) reject(err);
                else resolve(channel.title);
            });
        });
    };

    bot.command(`tags`, adminMiddleware(), ctx => {
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

            const channels = Object.entries(chat.tags)
                .reduce((result, [tag, channels]) => {
                    channels.forEach(channel => {
                        if (channel in result) {
                            result[channel].push(`#${tag}`);
                        } else {
                            result[channel] = [`#${tag}`];
                        }
                    });
                    return result;
                }, {});

            const titles = await Object.keys(channels)
                .reduce(async (promise, channel) => {
                    const titles = await promise;
                    titles[channel] = await getChannelTitle(Number(channel));
                    return titles;
                }, Promise.resolve({}));

            ctx.reply(
                Object.entries(channels)
                    .map(([channel, tags]) =>
                        `» ${tags.join(`, `)} → ${titles[channel]}`,
                    )
                    .join(`\n`) || `No tags in this chat.`,
            );
        });
    });
};
