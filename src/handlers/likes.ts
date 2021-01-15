import { Composer } from 'telegraf';
import CustomContext from '../context';
import { Like as ILike } from '../typings/db';
import Like from '../models/like';

export const actionMap = {
    '+': '👍',
    '-': '👎',
};

export const likes = Composer.action<CustomContext>(/^(\+|-)1$/, async ctx => {
    const action = ctx.match[1] as ILike['action'];
    const { from, message } = ctx.callbackQuery;
    if (!message) return;

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore telegram-typings is outdated
    const { message_id, chat, reply_markup } = message;
    const { id: chat_id } = chat;
    const { inline_keyboard: inlineKeyboard } = reply_markup;

    const query = { chat_id, message_id, from_id: from.id };

    let like: ILike | null;
    try {
        like = await Like.findOne(query);
    } catch (err) {
        await ctx.handleError(err);
        return;
    }

    if (!like) {
        await new Like({
            ...query,
            action: action as ILike['action'],
        }).save();

        await ctx.answerCbQuery(`You ${actionMap[action]} this.`);
    } else if (like.action === action) {
        await like.deleteOne();
        await ctx.answerCbQuery('You took your reaction back.');
    } else {
        like.action = action;
        await like.save();
        await ctx.answerCbQuery(`You ${actionMap[action]} this.`);
    }

    try {
        const [plus, minus] = await ctx.countLikes(chat_id, message_id);

        ctx.editMessageReplyMarkup({
            inline_keyboard: [ctx.formatLikeKeyboard(plus, minus), ...inlineKeyboard.slice(1)],
        });
    } catch (err) {
        await ctx.handleError(err);
    }
});
