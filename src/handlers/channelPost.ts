import Channel from '../models/channel';
import { Composer } from 'telegraf';
import CustomContext from '../context';
import { deunionize } from '../utils';

export const channelPost = Composer.on<CustomContext, 'channel_post'>('channel_post', async ctx => {
    const connectCommands: string[] = ['/connect', `@${ctx.me}`.toLowerCase()];
    const message = deunionize(ctx.channelPost);

    if (message.text && connectCommands.includes(message.text.toLowerCase())) {
        const { title, username } = message.chat;
        const admins = (await ctx.getChatAdministrators())
            .map(({ user: { id } }) => id)
            .filter(id => id !== ctx.botInfo.id);

        await Channel.updateOne({ chat_id: message.chat.id }, { $set: { admins, title, username } }, { upsert: true });

        const reply = await ctx.reply('Your channel has been connected 👍');
        ctx.deleteMessage();

        setTimeout(() => {
            ctx.deleteMessage(reply.message_id);
        }, 5000);
    }
});
