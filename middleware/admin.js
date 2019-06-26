module.exports = async (ctx, next) => {
    const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);

    if ([`creator`, `administrator`].includes(member.status)) {
        next();
    }
};
