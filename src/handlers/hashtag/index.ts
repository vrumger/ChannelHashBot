import { Composer } from 'grammy';
import { handleEditedMessage } from './edited-message';
import { handleNewMessage } from './new-message';

const composer = new Composer();

composer
    .filter(ctx =>
        Boolean(ctx.chat && ['group', 'supergroup'].includes(ctx.chat.type)),
    )
    .on(['message::hashtag', 'edited_message::hashtag'], async ctx => {
        // Use `forward_date` because it's always there for every type of forward
        if (ctx.msg.forward_date) {
            return;
        }

        let entities = ctx.msg.entities ?? ctx.msg.caption_entities ?? [];
        let text = ctx.msg.text ?? ctx.msg.caption ?? '';

        const hashtagEntities = entities.filter(
            entity => entity.type === 'hashtag',
        );
        const tags = hashtagEntities.map(entity =>
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

        const reply = ctx.msg.reply_to_message;
        const message = untaggedText === '' && reply ? reply : ctx.msg;

        entities = message.entities ?? message.caption_entities ?? [];
        text = message.text ?? message.caption ?? '';

        if (ctx.editedMessage) {
            await handleEditedMessage(
                ctx,
                message,
                entities,
                text,
                Boolean(message.caption),
                hashtagEntities,
                tags,
            );
        } else {
            await handleNewMessage(
                ctx,
                message,
                entities,
                text,
                Boolean(message.caption),
                hashtagEntities,
                tags,
            );
        }
    });

export default composer;
