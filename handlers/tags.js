const escapeHtml = require(`@youtwitface/escape-html`);
const adminMiddleware = require(`../middleware/admin`);

module.exports = (bot, db) => {
    const formatName = channel => {
        const title = escapeHtml(
            channel.title
                ? channel.title
                : `${channel.first_name} ${channel.last_name || ``}`.trim(),
        );

        if (!channel.username) {
            return title;
        }

        return `<a href="https://t.me/${channel.username}">${title}</a>`;
    };

    const getChannelTitle = chat_id => {
        return new Promise((resolve, reject) => {
            if (chat_id >= 0) {
                // TODO: cache names
                return bot.telegram
                    .getChat(chat_id)
                    .then(user => resolve(formatName(user)));
            }

            db.channels.findOne({ chat_id }, (err, channel) => {
                if (err) reject(err);
                else resolve(formatName(channel));
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
                .reduce((result, [_tag, channels]) => {
                    const tag = escapeHtml(`#${_tag}`);
                    channels = Array.isArray(channels) ? channels : [channels];

                    channels.forEach(channel => {
                        if (channel in result) {
                            result[channel].push(tag);
                        } else {
                            result[channel] = [tag];
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

            const message =Object.entries(channels)
                .map(([channel, tags]) =>
                    `» ${tags.join(`, `)} → ${titles[channel]}`,
                )
                .join(`\n`) || `No tags in this chat.`;

            ctx.reply(message, {
                parse_mode: `html`,
                disable_web_page_preview: true,
            });
        });
    });
};
