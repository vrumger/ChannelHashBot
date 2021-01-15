import { Channel as IChannel, Group as IGroup } from '../typings/db';
import Channel from '../models/channel';
import { Composer } from 'telegraf';
import CustomContext from '../context';
import Group from '../models/group';
import { Chat as TChat } from 'telegraf/typings/telegram-types';
import { bot } from '../bot';
import escapeHtml from '@youtwitface/escape-html';

const formatLink = (username: string, name: string) => `<a href="https://t.me/${username}">${name}</a>`;

const formatChannelTitle = (channel: IChannel) => {
    const title = escapeHtml(channel.title);
    return channel.username ? formatLink(channel.username, title) : title;
};

const formatUserName = (user: TChat) => {
    const firstName = 'first_name' in user ? user.first_name : null;
    const lastName = 'last_name' in user ? user.last_name : '';
    const username = 'username' in user ? user.username : null;

    const name = escapeHtml(`${firstName} ${lastName}`.trim());
    return username ? formatLink(username, name) : name;
};

const getChannelTitle = (chat_id: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (chat_id >= 0) {
            // TODO: cache names
            return bot.telegram.getChat(chat_id).then(user => resolve(formatUserName(user)));
        }

        Channel.findOne({ chat_id })
            .then(channel => resolve(channel ? formatChannelTitle(channel) : 'Unknown channel'))
            .catch(err => reject(err));
    });
};

export const tags = Composer.command<CustomContext>(
    'tags',
    Composer.groupChat(
        Composer.admin(async ctx => {
            const { chat } = ctx.message;
            if (!chat.type.includes('group')) return;

            let dbChat: IGroup | null;
            try {
                dbChat = await Group.findOne({ chat_id: chat.id });
            } catch (err) {
                console.error(err);
                ctx.reply('There was an error.');
                return;
            }

            if (!dbChat) {
                dbChat = new Group({ chat_id: chat.id, tags: {} });
            } else if (!dbChat.tags) {
                dbChat.tags = {};
            }

            const channels = Object.entries(dbChat.tags || {}).reduce((result, [_tag, channels]) => {
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
                    .map(([channel, tags]) => `» ${tags.join(', ')} → ${titles[channel]}`)
                    .join('\n') || 'No tags in this chat.';

            ctx.reply(message, {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
            });
        }),
    ),
);
