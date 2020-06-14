import { Database, TBot, TContext, TNext } from '../typings';
import formatLikeKeyboard, { actionMap } from '../middleware/formatLikeKeyboard';
import countLikesFunc from '../middleware/countLikes';
import { Like } from '../typings/db';

const errorMiddleware = (ctx: TContext, next: TNext) => {
    ctx.handleError = err => {
        if (err) {
            console.log(err);
            ctx.answerCbQuery(`🚫 There was an error.`);
            return true;
        }

        return false;
    };

    next();
};

export default (bot: TBot, db: Database) => {
    const countLikes = countLikesFunc(db);

    bot.action(/^(\+|-)1$/, errorMiddleware, ctx => {
        const action = ctx.match![1] as Like['action'];
        const { message } = ctx.callbackQuery!;
        if (!message) return;

        // @ts-ignore telegram-typings is outdated
        const { message_id, chat, reply_markup } = message;
        const { id: chat_id } = chat;
        const { inline_keyboard: inlineKeyboard } = reply_markup;

        const query = { chat_id, message_id, from_id: ctx.from!.id };

        db.likes.findOne(query, async (err, like) => {
            if (ctx.handleError!(err)) return;

            if (!like) {
                db.likes.insert({ ...query, action: action as Like['action'] }, () => {
                    if (ctx.handleError!(err)) return;
                    ctx.answerCbQuery(`You ${actionMap.get(action)} this.`);
                });
            } else if (like.action === action) {
                db.likes.remove(query, {}, err => {
                    if (ctx.handleError!(err)) return;
                    ctx.answerCbQuery(`You took your reaction back.`);
                });
            } else {
                db.likes.update(query, { $set: { action } }, {}, err => {
                    if (ctx.handleError!(err)) return;
                    ctx.answerCbQuery(`You ${actionMap.get(action)} this.`);
                });
            }

            try {
                const [plus, minus] = await countLikes(chat_id, message_id);

                ctx.editMessageReplyMarkup({
                    inline_keyboard: [formatLikeKeyboard(plus, minus), ...inlineKeyboard.slice(1)],
                });
            } catch (err) {
                ctx.handleError!(err);
            }
        });
    });
};
