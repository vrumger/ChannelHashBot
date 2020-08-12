import { GroupTags, Group as IGroup } from '../typings/db';
import Group from '../models/group';
import { TBot } from '../typings';
import adminMiddleware from '../middleware/admin';

export default (bot: TBot): void => {
    bot.command('unwatch', adminMiddleware(), async ctx => {
        if (!ctx.chat!.type.includes('group')) return;

        const { text, entities } = ctx.message!;

        let chat: IGroup | null;
        try {
            chat = await Group.findOne({ chat_id: ctx.chat!.id });
        } catch (err) {
            console.error(err);
            ctx.reply('There was an error.');
            return;
        }

        if (!chat) {
            ctx.reply('Chat not found.');
            return;
        }

        const tags = (entities || [])
            .filter(entity => entity.type === 'hashtag')
            .map(entity =>
                text!.slice(entity.offset + 1, entity.offset + entity.length),
            );
        const _tags: GroupTags = { ...chat.tags };

        if (chat.tags) {
            tags.forEach(tag => delete _tags[tag]);
        }

        chat.tags = _tags;
        await chat.save();

        ctx.reply(
            `The following tags have been removed:\n${tags
                .map(tag => `#${tag}`)
                .join(', ')}`,
        );
    });
};
