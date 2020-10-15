// TODO: cleanup

const textToHtml = require(`@youtwitface/text-to-html`);
const commentMiddleware = require(`../middleware/createComment`);
const formatLikeKeyboard = require(`../middleware/formatLikeKeyboard`);
const { actionMap } = formatLikeKeyboard;

var sendPMID, originalRequest;

module.exports = (bot, db) => {
    const countLikes = require(`../middleware/countLikes`)(db);

    const getReplyMarkup = ({
        chat,
        directLink,
        message_id,
        plus = 0,
        minus = 0,
    }) => {
        const inlineKeyboard = [];

        if (chat.settings && chat.settings.likes) {
            inlineKeyboard.push(formatLikeKeyboard(plus, minus));
        }

        if (chat.settings && chat.settings.link) {
            inlineKeyboard.push([
                {
                    text: `Original Request`,
                    url: `https://t.me/${directLink}/${message_id}`,
                },
                {
                  text: `Send PM Notif`,
                  callback_data: `callback_query_notif`,
                },
            ]);
        }
        originalRequest = `https://t.me/${directLink}/${message_id}`;
        return {
            inline_keyboard: inlineKeyboard,
        };
    };

    const getMessage = ctx => {
        const message = ctx.message || ctx.editedMessage;
        var { forward_date, reply_to_message: reply } = message;

        // Use `forward_date` becuase it's always there
        // for every type of forward
        if (forward_date) return;

        let entities = message.entities || message.caption_entities || [];
        let text = message.text || message.caption || ``;

        const hashtagEntities = entities.filter(
            entity => entity.type === `hashtag`,
        );

        const tags = hashtagEntities
            .filter(entity => entity.type === `hashtag`)
            .map(entity =>
                text
                    .slice(entity.offset + 1, entity.offset + entity.length)
                    .toLowerCase(),
            );

        const untaggedText = hashtagEntities
            .reduce(
                (res, entity) =>
                    res.slice(0, entity.offset) +
                    res.slice(entity.offset + entity.length),
                text,
            )
            .trim();

        const messageToSend = untaggedText !== `` || !reply ? message : reply;
        text =  ctx.from.first_name + `:\n\n` + messageToSend.text || messageToSend.caption || ``;
        entities =
            messageToSend.entities || messageToSend.caption_entities || [];
        //sendPMID = 12345678;
        sendPMID = ctx.from.id;
        //module.exports.sendPMID = sendPMID;
        console.log(sendPMID + "is the id")

        const countLikes = require(`../middleware/countLikes`)(db);
        
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

        
        return {
            message: messageToSend,
            text,
            entities,
            tags,
        };
    };


    const sendMessage = async (ctx, chat, channel, message, text, entities) => {
        // Use `!== false` in case it's `undefined`
        if (!chat.settings || chat.settings.forwards !== false) {
            return await ctx.telegram.forwardMessage(
                channel,
                ctx.chat.id,
                message.message_id,
            );
        }

        const parsedMessage = textToHtml(text, entities);
        const chatId = ctx.chat.id.toString().slice(4);
        const directLink = ctx.chat.username || `c/${chatId}`;

        const options = {
            reply_markup: getReplyMarkup({
                chat,
                directLink,
                message_id: message.message_id,
            }),
            caption: parsedMessage,
            parse_mode: `html`,
        };

        let sentMessage;

        if (message.audio) {
            sentMessage = await ctx.telegram.sendAudio(
                channel,
                message.audio.file_id,
                options,
            );
        } else if (message.document) {
            sentMessage = await ctx.telegram.sendDocument(
                channel,
                message.document.file_id,
                options,
            );
        } else if (message.photo) {
            if (chat.settings.comments) {
                await ctx.createComment(parsedMessage, options);
            }

            sentMessage = await ctx.telegram.sendPhoto(
                channel,
                message.photo.pop().file_id,
                options,
            );
        } else if (message.video) {
            sentMessage = await ctx.telegram.sendVideo(
                channel,
                message.video.file_id,
                options,
            );
        } else {
            if (chat.settings.comments) {
                await ctx.createComment(parsedMessage, options);
            }

            sentMessage = await ctx.telegram.sendMessage(
                channel,
                parsedMessage,
                options,
            );
        }

        return sentMessage;
    };

    const handler = ctx => {
        if (!ctx.chat.type.includes(`group`)) return;
        
        const { message,  text, entities, tags } = getMessage(ctx);
        db.groups.findOne({ chat_id: ctx.chat.id }, async (err, chat) => {
            if (err) return console.error(err);
            if (!chat || !chat.tags) return;

            const sentChannels = [];

            for (const tag of tags) {
                if (!chat.tags[tag]) {
                    continue;
                }

                // Convert to array for backwards compatibility
                if (!Array.isArray(chat.tags[tag])) {
                    chat.tags[tag] = [chat.tags[tag]];
                }

                for (const channel of chat.tags[tag]) {
                    if (sentChannels.includes(channel)) {
                        continue;
                    }

                    const sentMessage = await sendMessage(
                        ctx,
                        chat,
                        channel,
                        message,
                        text,
                        entities,
                    );
                    sentChannels.push(channel);
                    db.messages.insert({
                        chat_id: ctx.chat.id,
                        message_id: message.message_id,
                        channel_id: channel,
                        channel_message_id: sentMessage.message_id,
                    });
                }
            }
        });
    };

    bot.entity(`hashtag`, commentMiddleware, handler);

    bot.on(`edited_message`, (ctx, next) => {
        if (!ctx.chat.type.includes(`group`)) return;

        const { message, text, entities } = getMessage(ctx);
        const { id: chat_id } = ctx.chat;

        db.messages.find(
            { chat_id, message_id: message.message_id },
            (err, channelMessages) => {
                if (err) return console.error(err);

                if (!channelMessages.length) {
                    const entities =
                        ctx.editedMessage.entities ||
                        ctx.editedMessage.caption_entities ||
                        [];

                    if (entities.some(entity => entity.type === `hashtag`)) {
                        commentMiddleware(ctx, next);
                        handler(ctx);
                    }

                    return;
                }

                db.groups.findOne({ chat_id }, async (err, chat) => {
                    if (err) return console.error(err);
                    if (!chat) return;

                    for (const channelMessage of channelMessages) {
                        // Use `!== false` in case it's `undefined`
                        if (
                            !chat.settings ||
                            chat.settings.forwards !== false
                        ) {
                            ctx.telegram.forwardMessage(
                                channelMessage.channel_id,
                                ctx.chat.id,
                                message.message_id,
                            );

                            ctx.telegram
                                .deleteMessage(
                                    channelMessage.channel_id,
                                    channelMessage.channel_message_id,
                                )
                                .catch(() => {});

                            continue;
                        }

                        const parsedMessage = textToHtml(text, entities);
                        const chatId = ctx.chat.id.toString().slice(4);
                        const directLink = ctx.chat.username || `c/${chatId}`;

                        const func =
                            message.audio ||
                            message.document ||
                            message.photo ||
                            message.video
                                ? ctx.telegram.editMessageCaption
                                : ctx.telegram.editMessageText;

                        const [plus, minus] = await countLikes(
                            chat_id,
                            channelMessage.channel_message_id,
                        );

                        func.call(
                            ctx.telegram,
                            channelMessage.channel_id,
                            channelMessage.channel_message_id,
                            null,
                            parsedMessage,
                            {
                                reply_markup: getReplyMarkup({
                                    chat,
                                    directLink,
                                    message_id: message.message_id,
                                    plus,
                                    minus,
                                }),
                                parse_mode: `html`,
                            },
                        ).catch(async err => {
                            console.log(err);

                            if (
                                err.description ===
                                `Bad Request: message to edit not found`
                            ) {
                                commentMiddleware(ctx, next);

                                const sentMessage = await sendMessage(
                                    ctx,
                                    chat,
                                    channelMessage.channel_id,
                                    message,
                                    parsedMessage,
                                    [],
                                );

                                db.messages.insert({
                                    chat_id: ctx.chat.id,
                                    message_id: message.message_id,
                                    channel_id: channelMessage.channel_id,
                                    channel_message_id: sentMessage.message_id,
                                });
                            } else {
                                console.log(err);
                            }
                        });
                    }
                });
            },
        );
    });
  bot.action('callback_query_notif', async ctx =>
  {
    const parse = 'html'
    ctx.telegram.sendMessage(sendPMID, `<i>Your (${originalRequest})[Request] has been fulfilled. Click(right click on desktop) on your request > View Thread to download your fulfilled book.</i>`, {parse})
    ctx.answerCbQuery(`Sent a notification to the requester!`);
    }
)

}; 
