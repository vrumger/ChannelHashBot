import Group from '../models/group';
import { TBot } from '../typings';

export default (bot: TBot): void => {
    bot.on('new_chat_members', async ctx => {
        await Promise.all(
            ctx.message!.new_chat_members!.map(async member => {
                if (member.id === ctx.botInfo!.id) {
                    await new Group({ chat_id: ctx.chat!.id }).save();
                }
            }),
        );
    });
};
