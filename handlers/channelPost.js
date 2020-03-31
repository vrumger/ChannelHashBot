module.exports = (bot, db) => {
    bot.on(`channel_post`, async ctx => {
        if (ctx.channelPost.text.toLowerCase() === `@${ctx.me}`.toLowerCase()) {
            const admins = (await ctx.getChatAdministrators())
                .map(({ user: { id } }) => id)
                .filter(id => id !== ctx.botInfo.id);

            db.channels.update(
                { chat_id: ctx.chat.id },
                { $set: { admins, title: ctx.chat.title } },
                { upsert: true },
            );

            const reply = await ctx.reply(
                `Success. This message will automatically delete in 5 seconds.`,
            );
            ctx.deleteMessage();

            setTimeout(() => {
                ctx.deleteMessage(reply.message_id);
            }, 5000);
        }
    });
};
