import { GroupTags, Group as IGroup } from '../typings/db';
import { Composer } from 'grammy';
import Group from '../models/group';

const composer = new Composer();

composer.command('unwatch', async ctx => {
    if (
        !ctx.chat ||
        !['group', 'supergroup'].includes(ctx.chat.type) ||
        ctx.senderChat?.type === 'channel'
    ) {
        return;
    }

    if (ctx.msg.sender_chat?.id === ctx.chat.id) {
        const user = await ctx.getAuthor();

        if (!['creator', 'administrator'].includes(user.status)) {
            return;
        }
    }

    const { chat, text, entities } = ctx.msg;

    let dbChat: IGroup | null;
    try {
        dbChat = await Group.findOne({ chat_id: chat.id });
    } catch (err) {
        console.error(err);
        await ctx.reply('There was an error.');
        return;
    }

    if (!dbChat) {
        await ctx.reply('Chat not found.');
        return;
    }

    const tags = (entities || [])
        .filter(entity => entity.type === 'hashtag')
        .map(entity =>
            text.slice(entity.offset + 1, entity.offset + entity.length),
        );
    const _tags: GroupTags = { ...dbChat.tags };

    if (dbChat.tags) {
        tags.forEach(tag => delete _tags[tag]);
    }

    dbChat.tags = _tags;
    await dbChat.save();

    await ctx.reply(
        `The following tags have been removed:\n${tags
            .map(tag => `#${tag}`)
            .join(', ')}`,
    );
});

export default composer;
