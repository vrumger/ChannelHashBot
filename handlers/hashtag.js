const textToHtml = require(`@youtwitface/text-to-html`);
const commentMiddleware = require(`../middleware/createComment`);

module.exports = (bot, db) => {
    bot.entity(`hashtag`, commentMiddleware, ctx => {
        if (!ctx.chat.type.includes(`group`)) return;

        const {
            message_id,
            forward_date,
            reply_to_message: reply,
            ...message
        } = ctx.message;

        // Use `forward_date` becuase it's always there
        // for every type of forward
        if (forward_date) return;

        let entities = message.entities || message.caption_entities || [];
        let text = message.text || message.caption;

        const hashtagEntities = entities.filter(
            entity => entity.type === `hashtag`
        );

        const tags = hashtagEntities
            .filter(entity => entity.type === `hashtag`)
            .map(entity =>
                text
                    .slice(entity.offset + 1, entity.offset + entity.length)
                    .toLowerCase()
            );

        const untaggedText = hashtagEntities
            .reduce(
                (res, entity) =>
                    res.slice(0, entity.offset) +
                    res.slice(entity.offset + entity.length),
                text
            )
            .trim();

        const messageToSend = untaggedText !== `` || !reply ? message : reply;
        text = messageToSend.text || messageToSend.caption;
        entities =
            messageToSend.entities || messageToSend.caption_entities || [];

        db.groups.findOne({ chat_id: ctx.chat.id }, async (err, chat) => {
            if (err) return console.error(err);
            if (!chat) return;

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

                    // Use `!== false` in case it's `undefined`
                    if (!chat.settings || chat.settings.forwards !== false) {
                        ctx.telegram.forwardMessage(
                            channel,
                            ctx.chat.id,
                            messageToSend.message_id
                        );
                        continue;
                    }

                    const parsedMessage = textToHtml(text, entities);
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

                    if (messageToSend.audio) {
                        ctx.telegram.sendAudio(
                            channel,
                            messageToSend.audio.file_id,
                            options
                        );
                    } else if (messageToSend.document) {
                        ctx.telegram.sendDocument(
                            channel,
                            messageToSend.document.file_id,
                            options
                        );
                    } else if (messageToSend.photo) {
                        if (chat.settings.comments) {
                            await ctx.createComment(parsedMessage, options);
                        }

                        ctx.telegram.sendPhoto(
                            channel,
                            messageToSend.photo.pop().file_id,
                            options
                        );
                    } else if (messageToSend.video) {
                        ctx.telegram.sendVideo(
                            channel,
                            messageToSend.video.file_id,
                            options
                        );
                    } else {
                        if (chat.settings.comments) {
                            await ctx.createComment(parsedMessage, options);
                        }

                        ctx.telegram.sendMessage(
                            channel,
                            parsedMessage,
                            options
                        );
                    }

                    sentChannels.push(channel);
                }
            }
        });
    });
};
