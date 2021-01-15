import { Composer } from 'telegraf';
import Group from '../models/group';

export const newChatMembers = Composer.on('new_chat_members', async ctx => {
    const { chat } = ctx.message;
    await Promise.all(
        ctx.message.new_chat_members.map(async member => {
            if (member.id === ctx.botInfo.id) {
                await new Group({ chat_id: chat.id }).save();
            }
        }),
    );
});
