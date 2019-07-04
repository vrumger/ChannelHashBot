const textToHtml = require(`@youtwitface/text-to-html`);
const commentMiddleware = require(`../middleware/createComment`);

module.exports = (bot, db) => {
    bot.entity(`hashtag`, commentMiddleware, ctx => {
        const {
            message_id,
            text,
            caption,
            entities,
            caption_entities,
            forward_date,
            ...message
        } = ctx.message;

        // Use `forward_date` becuase it's always there
        // for every type of forward
        if (forward_date) return;

        const tags = (entities || caption_entities || [])
            .filter(entity => entity.type === `hashtag`)
            .map(entity =>
                (text || caption).slice(
                    entity.offset + 1,
                    entity.offset + entity.length
                )
            );

        db.groups.findOne({ chat_id: ctx.chat.id }, async (err, chat) => {
            if (err) return console.error(err);
            if (!chat) return;

            for (const tag of tags) {
                if (!chat.tags[tag]) continue;

                // Use `!== false` in case it's `undefined`
                if (!chat.settings || chat.settings.forwards !== false) {
                    ctx.forwardMessage(chat.tags[tag]);
                    continue;
                }

                const parsedMessage = textToHtml(
                    text || caption,
                    entities || caption_entities || []
                );

                const chatId = ctx.chat.id.toString().slice(4);
                const directLink = ctx.chat.username || `c/${chatId}`;
                const options = {
                    reply_markup: chat.settings &&
                        chat.settings.link && {
                        inline_keyboard: [
                            [
                                {
                                    text: `Go to message`,
                                    url: `https://t.me/${directLink}/${message_id}`,
                                },
                            ],
                        ],
                    },
                    caption: parsedMessage,
                    parse_mode: `html`,
                };

                if (message.audio) {
                    ctx.telegram.sendAudio(
                        chat.tags[tag],
                        message.audio.file_id,
                        options
                    );
                } else if (message.document) {
                    ctx.telegram.sendDocument(
                        chat.tags[tag],
                        message.document.file_id,
                        options
                    );
                } else if (message.photo) {
                    if (chat.settings.comments) {
                        await ctx.createComment(parsedMessage, options);
                    }

                    ctx.telegram.sendPhoto(
                        chat.tags[tag],
                        message.photo.pop().file_id,
                        options
                    );
                } else if (message.video) {
                    ctx.telegram.sendVideo(
                        chat.tags[tag],
                        message.video.file_id,
                        options
                    );
                } else {
                    if (chat.settings.comments) {
                        await ctx.createComment(parsedMessage, options);
                    }

                    ctx.telegram.sendMessage(
                        chat.tags[tag],
                        parsedMessage,
                        options
                    );
                }
            }
        });
    });
};
