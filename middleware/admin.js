const adminStatuses = [`creator`, `administrator`];

module.exports = useAsFunction => {
    return async (ctx, next) => {
        if (useAsFunction) {
            ctx.isAdmin = async (chatId, fromId) => {
                const member = await ctx.telegram.getChatMember(chatId, fromId);
                return adminStatuses.includes(member.status);
            };

            next();
        } else {
            const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);

            if (adminStatuses.includes(member.status)) {
                next();
            }
        }
    };
};
