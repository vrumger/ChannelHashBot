import Channel from '../models/channel';
import { Chat } from '@grammyjs/types';
import { Composer } from 'grammy';

const composer = new Composer();

composer.on('channel_post', async ctx => {
    const connectCommands = ['/connect', `@${ctx.me.username}`.toLowerCase()];

    if (ctx.msg.text && connectCommands.includes(ctx.msg.text.toLowerCase())) {
        const { title, username } = ctx.msg.chat as Chat.ChannelChat;
        const admins = (await ctx.getChatAdministrators())
            .map(({ user: { id } }) => id)
            .filter(id => id !== ctx.me.id);

        await Channel.updateOne(
            { chat_id: ctx.msg.chat.id },
            { $set: { admins, title, username } },
            { upsert: true },
        );

        const reply = await ctx.reply('Your channel has been connected 👍');
        await ctx.deleteMessage();

        setTimeout(() => {
            ctx.api
                .deleteMessage(ctx.msg.chat.id, reply.message_id)
                .catch(() => {
                    // Ignore error
                });
        }, 5000);
    }
});

export default composer;
