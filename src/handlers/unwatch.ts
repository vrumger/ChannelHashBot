import { GroupTags, Group as IGroup } from '../typings/db';
import { Composer } from 'telegraf';
import CustomContext from '../context';
import Group from '../models/group';
import { deunionize } from '../utils';

export const unwatch = Composer.command<CustomContext>(
    'unwatch',
    Composer.groupChat(
        Composer.admin(async ctx => {
            const { chat, text, entities } = deunionize(ctx.message);

            let dbChat: IGroup | null;
            try {
                dbChat = await Group.findOne({ chat_id: chat.id });
            } catch (err) {
                console.error(err);
                ctx.reply('There was an error.');
                return;
            }

            if (!dbChat) {
                ctx.reply('Chat not found.');
                return;
            }

            const tags = (entities || [])
                .filter(entity => entity.type === 'hashtag')
                .map(entity => text.slice(entity.offset + 1, entity.offset + entity.length));
            const _tags: GroupTags = { ...dbChat.tags };

            if (dbChat.tags) {
                tags.forEach(tag => delete _tags[tag]);
            }

            dbChat.tags = _tags;
            await dbChat.save();

            ctx.reply(`The following tags have been removed:\n${tags.map(tag => `#${tag}`).join(', ')}`);
        }),
    ),
);
