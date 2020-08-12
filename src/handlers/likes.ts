import { TBot, TContext, TNext } from '../typings';
import formatLikeKeyboard, {
    actionMap,
} from '../middleware/formatLikeKeyboard';
import { Like as ILike } from '../typings/db';
import Like from '../models/like';
import countLikes from '../middleware/countLikes';

const errorMiddleware = (ctx: TContext, next: TNext) => {
    ctx.handleError = err => {
        if (err) {
            console.log(err);
            ctx.answerCbQuery('🚫 There was an error.');
            return true;
        }

        return false;
    };

    next();
};

export default (bot: TBot): void => {
    bot.action(/^(\+|-)1$/, errorMiddleware, async ctx => {
        const action = ctx.match![1] as ILike['action'];
        const { message } = ctx.callbackQuery!;
        if (!message) return;

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore telegram-typings is outdated
        const { message_id, chat, reply_markup } = message;
        const { id: chat_id } = chat;
        const { inline_keyboard: inlineKeyboard } = reply_markup;

        const query = { chat_id, message_id, from_id: ctx.from!.id };

        let like: ILike | null;
        try {
            like = await Like.findOne(query);
        } catch (err) {
            ctx.handleError!(err);
            return;
        }

        if (!like) {
            await new Like({
                ...query,
                action: action as ILike['action'],
            }).save();

            ctx.answerCbQuery(`You ${actionMap[action]} this.`);
        } else if (like.action === action) {
            await like.deleteOne();
            ctx.answerCbQuery('You took your reaction back.');
        } else {
            like.action = action;
            await like.save();
            ctx.answerCbQuery(`You ${actionMap[action]} this.`);
        }

        try {
            const [plus, minus] = await countLikes(chat_id, message_id);

            ctx.editMessageReplyMarkup({
                inline_keyboard: [
                    formatLikeKeyboard(plus, minus),
                    ...inlineKeyboard.slice(1),
                ],
            });
        } catch (err) {
            ctx.handleError!(err);
        }
    });
};
