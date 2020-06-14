import { TBot, Database } from '../typings';
import adminMiddleware from '../middleware/admin';

export default (bot: TBot, db: Database) => {
    bot.command(`unwatch`, adminMiddleware(), ctx => {
        if (!ctx.chat!.type.includes(`group`)) return;

        const { text, entities } = ctx.message!;

        db.groups.findOne({ chat_id: ctx.chat!.id }, (err, chat) => {
            if (err) {
                console.error(err);
                ctx.reply(`There was an error.`);
                return;
            }

            if (!chat) {
                ctx.reply(`Chat not found.`);
                return;
            }

            const tags = (entities || [])
                .filter(entity => entity.type === `hashtag`)
                .map(entity => text!.slice(entity.offset + 1, entity.offset + entity.length));

            if (chat.tags) {
                tags.forEach(tag => delete chat.tags![tag]);
            }

            db.groups.update({ chat_id: ctx.chat!.id }, { $set: { tags: chat.tags } });
            ctx.reply(`The following tags have been removed:\n${tags.map(tag => `#${tag}`).join(`, `)}`);
        });
    });
};
