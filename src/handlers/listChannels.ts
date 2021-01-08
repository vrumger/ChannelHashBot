import Channel from '../models/channel';
import { Composer } from 'telegraf';
import { InlineKeyboardMarkup } from 'telegraf/typings/telegram-types';
import { TBot } from '../typings';

export default (bot: TBot): void => {
    const getChannelButtons = async (userId: number): Promise<InlineKeyboardMarkup['inline_keyboard'] | null> => {
        const channels = await Channel.find({ admins: { $in: [userId] } });

        if (channels.length === 0) {
            return null;
        }

        return channels.map(channel => {
            return [
                {
                    text: channel.title,
                    callback_data: `reload:${channel.chat_id}`,
                },
                {
                    text: '🔄 Reload admins',
                    callback_data: `reload:${channel.chat_id}`,
                },
            ];
        });
    };

    bot.command(
        'channels',
        Composer.privateChat(async ctx => {
            const buttons = await getChannelButtons(ctx.from!.id);

            if (buttons === null) {
                await ctx.reply('You don\'t have any channels.');
                return;
            }

            await ctx.reply('Here\'s a list of channels that I\'m admin in with you.', {
                reply_markup: {
                    inline_keyboard: buttons,
                },
            });
        }),
    );

    bot.action(/^reload:(-\d+)$/, async ctx => {
        const chatId = Number(ctx.match![1]);

        let admins: number[] = [];
        try {
            admins = (await ctx.tg.getChatAdministrators(chatId))
                .map(({ user: { id } }) => id)
                .filter(id => id !== ctx.botInfo!.id);
        } catch (error) {
            const errors = [
                'Forbidden: bot was kicked from the channel chat',
                'Bad Request: chat not found',
                'Bad Request: member list is inaccessible',
            ];

            if (!errors.includes(error.description)) {
                throw error;
            }
        }

        await Channel.updateOne({ chat_id: chatId }, { $set: { admins } });

        if (!admins.includes(ctx.from!.id)) {
            const buttons = await getChannelButtons(ctx.from!.id);

            if (buttons === null) {
                await ctx.editMessageText('You don\'t have any channels.');
            } else {
                await ctx.editMessageReplyMarkup({ inline_keyboard: buttons });
            }
        }

        await ctx.answerCbQuery('Updated 👍');
    });
};
