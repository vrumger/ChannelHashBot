import { TBot, Database } from '../typings';

export default (bot: TBot, db: Database) => {
    bot.on(`new_chat_members`, ctx => {
        ctx.message!.new_chat_members!.forEach(member => {
            if (member.id === ctx.botInfo!.id) {
                db.groups.insert({ chat_id: ctx.chat!.id });
            }
        });
    });
};
