import { countLikes, formatLikeKeyboard, handleError } from '../utils';
import { Composer } from 'grammy';
import { Like as ILike } from '../typings/db';
import Like from '../models/like';

const composer = new Composer();

export const actionMap = {
    '+': '👍',
    '-': '👎',
};

composer.callbackQuery(/^(\+|-)1$/, async ctx => {
    const action = ctx.match![1] as ILike['action'];
    const from = ctx.from;

    if (!ctx.msg) {
        return;
    }

    const query = {
        chat_id: ctx.msg.chat.id,
        message_id: ctx.msg.message_id,
        from_id: from.id,
    };

    let like: ILike | null;
    try {
        like = await Like.findOne(query);
    } catch (err) {
        await handleError(ctx, err);
        return;
    }

    if (!like) {
        await new Like({
            ...query,
            action: action as ILike['action'],
        }).save();

        await ctx.answerCallbackQuery({
            text: `You ${actionMap[action]} this.`,
        });
    } else if (like.action === action) {
        await like.deleteOne();
        await ctx.answerCallbackQuery({ text: 'You took your reaction back.' });
    } else {
        like.action = action;
        await like.save();
        await ctx.answerCallbackQuery({
            text: `You ${actionMap[action]} this.`,
        });
    }

    try {
        const [plus, minus] = await countLikes(
            ctx.msg.chat.id,
            ctx.msg.message_id,
        );

        await ctx.editMessageReplyMarkup({
            reply_markup: formatLikeKeyboard(
                plus,
                minus,
                ctx.msg.reply_markup?.inline_keyboard.slice(1),
            ),
        });
    } catch (err) {
        await handleError(ctx, err);
    }
});

export default composer;
