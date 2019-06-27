const textToHtml = require(`@youtwitface/text-to-html`);

module.exports = (bot, db) => {
    bot.hashtag(ctx => {
        db.groups.findOne({ chat_id: ctx.chat.id }, (err, chat) => {
            if (err) return console.error(err);
            if (!chat) return;

            const {
                message_id,
                text,
                caption,
                entities,
                caption_entities,
            } = ctx.message;

            const tags = (entities || caption_entities || [])
                .filter(entity => entity.type === `hashtag`)
                .map(entity =>
                    (text || caption).slice(
                        entity.offset + 1,
                        entity.offset + entity.length
                    )
                );

            for (const tag of tags) {
                if (chat.tags[tag]) {
                    // Use `!== false` in case it's `undefined`
                    if (!chat.settings || chat.settings.forwards !== false) {
                        ctx.forwardMessage(chat.tags[tag]);
                    } else {
                        const chatId = ctx.chat.id.toString().slice(4);
                        const replyMarkup = chat.settings &&
                            chat.settings.link && {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        {
                                            text: `Go to message`,
                                            url: `https://t.me/c/${chatId}/${message_id}`,
                                        },
                                    ],
                                ],
                            },
                        };

                        ctx.telegram.sendMessage(
                            chat.tags[tag],
                            textToHtml(text || caption),
                            { ...replyMarkup, parse_mode: `html` }
                        );
                    }
                }
            }
        });
    });
};
