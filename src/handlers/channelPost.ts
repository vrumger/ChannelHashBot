import Channel from '../models/channel';
import { TBot } from '../typings';

export default (bot: TBot): void => {
    bot.on('channel_post', async ctx => {
        if (
            ctx.channelPost!.text?.toLowerCase() === `@${ctx.me}`.toLowerCase()
        ) {
            const { title, username } = ctx.chat!;
            const admins = (await ctx.getChatAdministrators())
                .map(({ user: { id } }) => id)
                .filter(id => id !== ctx.botInfo!.id);

            await Channel.updateOne(
                { chat_id: ctx.chat!.id },
                { $set: { admins, title, username } },
                { upsert: true },
            );

            const reply = await ctx.reply(
                'Success. This message will automatically be deleted in 5 seconds.',
            );
            ctx.deleteMessage();

            setTimeout(() => {
                ctx.deleteMessage(reply.message_id);
            }, 5000);
        }
    });
};
