
//const sendPMID = require('./hashtag/sendPMID');

const formatLikeKeyboard = require(`../middleware/formatLikeKeyboard`);
const hashtag = require(`./hashtag`)
//console.log(sendPMID)
const { actionMap } = formatLikeKeyboard;

const errorMiddleware = (ctx, next) => {
    ctx.handleError = err => {
        if (err) {
            console.log(err);
            ctx.answerCbQuery(`🚫 There was an error.`);
            return true;
        }
    };

    next();
};

module.exports = (bot, db) => {
    const countLikes = require(`../middleware/countLikes`)(db);
   
    bot.action(/^(\+|-)1$/, errorMiddleware, ctx => {
        const [, action] = ctx.match;
        const {
            from: { id: from_id },
            message: {
                message_id,
                chat: { id: chat_id },
                reply_markup: { inline_keyboard: inlineKeyboard },
            },
        } = ctx.callbackQuery;

        const query = { chat_id, message_id, from_id };

        db.likes.findOne(query, async (err, like) => {
            if (ctx.handleError(err)) return;

            if (!like) {
                db.likes.insert({ ...query, action }, () => {
                    if (ctx.handleError(err)) return;
                    ctx.answerCbQuery(`You ${actionMap.get(action)} this! click again to delete this.`);
                });
            } else if (like.action === action) {
                db.likes.remove(query, {}, err => {
                    if (ctx.handleError(err)) return;
                    if(actionMap.get(action) == "Fulfilled ✅")
                    {
                      //sendPMID = hashtag.sendPMID
                      //console.log("about to send PM to" + sendPMID)
                      //ctx.telegram.sendMessage(hashtag.sendPMID,`Your request has been fulfilled. Please visit @BookCrushGroup to find your fulfilled book.`);
                      //console.log("pm to send id: "+sendPMID);
                      //console.log(query.chat_id);
                      ctx.telegram.deleteMessage(query.chat_id,query.message_id);
                    }
                    //ctx.answerCbQuery(`You took your reaction back.`);
                });
            } else {
                db.likes.update(query, { $set: { action } }, {}, err => {
                    if (ctx.handleError(err)) return;
                    if(actionMap.get(action) == "Can't find ❌")
                    {
                      //const [plus, minus] = await countLikes(chat_id, message_id);
                      //if(minus == 2)

                      //ctx.telegram.sendMessage(-1001293118439,`Your request has been fulfilled. Please find it below this message`,query.message_id);
                      ctx.answerCbQuery(`You ${actionMap.get(action)} this.`);
                    }
                });
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
                ctx.handleError(err);
            }
        });
    });
};
