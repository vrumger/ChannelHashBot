const textToHtml = require(`@youtwitface/text-to-html`);
const commentMiddleware = require(`../middleware/createComment`);

module.exports = (bot, db) => {
    bot.entity(`hashtag`, commentMiddleware, ctx => {
        let {
            message_id,
            text,
            caption,
            entities,
            caption_entities,
            forward_date,
            reply_to_message,
        } = ctx.message;

        // Use `forward_date` becuase it's always there
        // for every type of forward
        if (forward_date) return;

        entities = entities || caption_entities || [];
        const hashtagEntities = entities.filter(
            entity => entity.type === `hashtag`
        );

        const tags = hashtagEntities
            .filter(entity => entity.type === `hashtag`)
            .map(entity =>
                (text || caption).slice(
                    entity.offset + 1,
                    entity.offset + entity.length
                )
            );

        const untaggedText = hashtagEntities
            .reduce(
                (res, entity) =>
                    res.slice(0, entity.offset) +
                    res.slice(entity.offset + entity.length),
                text
            )
            .trim();

        const messageToForward =
            untaggedText !== `` ? ctx.message : reply_to_message;

        db.groups.findOne({ chat_id: ctx.chat.id }, async (err, chat) => {
            if (err) return console.error(err);
            if (!chat) return;

            const sentChannels = [];

            for (const tag of tags) {
                if (!chat.tags[tag] || sentChannels(chat.tags[tag])) continue;

                // Use `!== false` in case it's `undefined`
                if (!chat.settings || chat.settings.forwards !== false) {
                    ctx.telegram.forwardMessage(
                        chat.tags[tag],
                        messageToForward.message_id
                    );
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

                if (messageToForward.audio) {
                    ctx.telegram.sendAudio(
                        chat.tags[tag],
                        messageToForward.audio.file_id,
                        options
                    );
                } else if (messageToForward.document) {
                    ctx.telegram.sendDocument(
                        chat.tags[tag],
                        messageToForward.document.file_id,
                        options
                    );
                } else if (messageToForward.photo) {
                    if (chat.settings.comments) {
                        await ctx.createComment(parsedMessage, options);
                    }

                    ctx.telegram.sendPhoto(
                        chat.tags[tag],
                        messageToForward.photo.pop().file_id,
                        options
                    );
                } else if (messageToForward.video) {
                    ctx.telegram.sendVideo(
                        chat.tags[tag],
                        messageToForward.video.file_id,
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
