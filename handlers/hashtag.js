module.exports = (bot, db) => {
    bot.hashtag(ctx => {
        db.groups.findOne({ chat_id: ctx.chat.id }, (err, chat) => {
            if (err) return console.error(err);
            if (!chat) return;

            const { text, caption, entities, caption_entities } = ctx.message;

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
                    const forward = !chat.settings || chat.settings.forward;

                    if (forward) {
                        ctx.forwardMessage(chat.tags[tag]);
                    } else {
                        ctx.telegram.sendMessage(
                            chat.tags[tag],
                            text || caption
                        );
                    }
                }
            }
        });
    });
};
