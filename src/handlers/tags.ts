import { Api, Composer } from 'grammy';
import { Channel as IChannel, Group as IGroup } from '../typings/db';
import Channel from '../models/channel';
import { Chat } from '@grammyjs/types';
import Group from '../models/group';
import escapeHtml from '@youtwitface/escape-html';

const composer = new Composer();

const formatLink = (username: string, name: string) =>
    `<a href="https://t.me/${username}">${name}</a>`;

const formatChannelTitle = (channel: IChannel) => {
    const title = escapeHtml(channel.title);
    return channel.username ? formatLink(channel.username, title) : title;
};

const formatUserName = (user: Chat) => {
    const firstName = 'first_name' in user ? user.first_name : null;
    const lastName = 'last_name' in user ? user.last_name : '';
    const username = 'username' in user ? user.username : null;

    const name = escapeHtml(`${firstName} ${lastName}`.trim());
    return username ? formatLink(username, name) : name;
};

const getChannelTitle = (api: Api, chat_id: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (chat_id >= 0) {
            // TODO: cache names
            return api
                .getChat(chat_id)
                .then(user => resolve(formatUserName(user)));
        }

        Channel.findOne({ chat_id })
            .then(channel =>
                resolve(
                    channel ? formatChannelTitle(channel) : 'Unknown channel',
                ),
            )
            .catch(err => reject(err));
    });
};

composer.command('tags', async ctx => {
    if (
        !ctx.chat ||
        !['group', 'supergroup'].includes(ctx.chat?.type) ||
        ctx.senderChat?.type === 'channel'
    ) {
        return;
    }

    const isAnonymous = ctx.msg.sender_chat?.id === ctx.chat.id;

    if (!isAnonymous) {
        const user = await ctx.getAuthor();

        if (!['creator', 'administrator'].includes(user.status)) {
            return;
        }
    }

    const { chat } = ctx.msg;
    if (!chat.type.includes('group')) return;

    let dbChat: IGroup | null;
    try {
        dbChat = await Group.findOne({ chat_id: chat.id });
    } catch (err) {
        console.error(err);
        await ctx.reply('There was an error.');
        return;
    }

    if (!dbChat) {
        dbChat = new Group({ chat_id: chat.id, tags: {} });
    } else if (!dbChat.tags) {
        dbChat.tags = {};
    }

    const channels = Object.entries(dbChat.tags || {}).reduce(
        (result, [_tag, channels]) => {
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
        },
        {} as { [k: string]: string[] },
    );

    const titles = await Object.keys(channels).reduce(
        async (promise, channel) => {
            const titles = await promise;
            titles[channel] = await getChannelTitle(ctx.api, Number(channel));
            return titles;
        },
        Promise.resolve({} as { [k: string]: string }),
    );

    const message =
        Object.entries(channels)
            .map(
                ([channel, tags]) =>
                    `» ${tags.join(', ')} → ${titles[channel]}`,
            )
            .join('\n') || 'No tags in this chat.';

    await ctx.reply(message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
    });
});

export default composer;
