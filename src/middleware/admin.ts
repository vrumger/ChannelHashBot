import { TContext, TNext } from '../typings';

const adminStatuses = [`creator`, `administrator`];

export default (useAsFunction: Boolean = false) => {
    return async (ctx: TContext, next: TNext) => {
        if (useAsFunction) {
            ctx.isAdmin = async (chatId: number, fromId: number) => {
                const member = await ctx.telegram.getChatMember(chatId, fromId);
                return adminStatuses.includes(member.status);
            };

            next();
        } else {
            const member = await ctx.telegram.getChatMember(ctx.chat!.id, ctx.from!.id);

            if (adminStatuses.includes(member.status)) {
                next();
            }
        }
    };
};
