// @ts-ignore
import escapeHtml from '@youtwitface/escape-html';
import { Chat as TChat } from 'telegraf/typings/telegram-types';
import adminMiddleware from '../middleware/admin';
import { TBot, Database } from '../typings';
import { Channel } from '../typings/db';

export default (bot: TBot, db: Database) => {
    const formatLink = (username: string, name: string) => `<a href="https://t.me/${username}">${name}</a>`;

    const formatChannelTitle = (channel: Channel) => {
        const title = escapeHtml(channel.title);
        return channel.username ? formatLink(channel.username, title) : title;
    };

    const formatUserName = (user: TChat) => {
        const name = escapeHtml(`${user.first_name} ${user.last_name || ``}`.trim());
        return user.username ? formatLink(user.username, name) : name;
    };

    const getChannelTitle = (chat_id: number): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (chat_id >= 0) {
                // TODO: cache names
                return bot.telegram.getChat(chat_id).then(user => resolve(formatUserName(user)));
            }

            db.channels.findOne({ chat_id }, (err, channel) => {
                if (err) reject(err);
                else resolve(formatChannelTitle(channel));
            });
        });
    };

    bot.command(`tags`, adminMiddleware(), ctx => {
        if (!ctx.chat!.type.includes(`group`)) return;

        const { id: chat_id } = ctx.chat!;

        db.groups.findOne({ chat_id }, async (err, chat) => {
            if (err) {
                console.error(err);
                ctx.reply(`There was an error.`);
                return;
            }

            if (!chat) {
                chat = { chat_id, tags: {} };
            } else if (!chat.tags) {
                chat.tags = {};
            }

            const channels = Object.entries(chat.tags || {}).reduce((result, [_tag, channels]) => {
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
            }, {} as { [k: string]: string[] });

            const titles = await Object.keys(channels).reduce(async (promise, channel) => {
                const titles = await promise;
                titles[channel] = await getChannelTitle(Number(channel));
                return titles;
            }, Promise.resolve({} as { [k: string]: string }));

            const message =
                Object.entries(channels)
                    .map(([channel, tags]) => `» ${tags.join(`, `)} → ${titles[channel]}`)
                    .join(`\n`) || `No tags in this chat.`;

            ctx.reply(message, {
                parse_mode: `HTML`,
                disable_web_page_preview: true,
            });
        });
    });
};
