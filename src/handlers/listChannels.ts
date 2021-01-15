import Channel from '../models/channel';
import { Composer } from 'telegraf';
import CustomContext from '../context';
import { InlineKeyboardMarkup } from 'telegraf/typings/telegram-types';

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

export const channels = Composer.command<CustomContext>(
    'channels',
    Composer.privateChat(async ctx => {
        const { from } = ctx.message;
        const buttons = await getChannelButtons(from.id);

        if (buttons === null) {
            // prettier-ignore
            await ctx.reply('You don\'t have any channels.');
            return;
        }

        // prettier-ignore
        await ctx.reply('Here\'s a list of channels that I\'m admin in with you.', {
            reply_markup: {
                inline_keyboard: buttons,
            },
        });
    }),
);

export const reloadChannel = Composer.action<CustomContext>(/^reload:(-\d+)$/, async ctx => {
    const { from } = ctx.callbackQuery;
    const chatId = Number(ctx.match[1]);

    let admins: number[] = [];
    try {
        admins = (await ctx.tg.getChatAdministrators(chatId))
            .map(({ user: { id } }) => id)
            .filter(id => id !== ctx.botInfo!.id);
    } catch (error) {
        const errors = [
            'Bad Request: chat not found',
            'Bad Request: member list is inaccessible',
            'Forbidden: bot is not a member of the channel chat',
            'Forbidden: bot was kicked from the channel chat',
        ];

        if (!errors.includes(error.description)) {
            throw error;
        }
    }

    await Channel.updateOne({ chat_id: chatId }, { $set: { admins } });

    if (!admins.includes(from.id)) {
        const buttons = await getChannelButtons(from.id);

        if (buttons === null) {
            // prettier-ignore
            await ctx.editMessageText('You don\'t have any channels.');
        } else {
            await ctx.editMessageReplyMarkup({ inline_keyboard: buttons });
        }
    }

    await ctx.answerCbQuery('Updated 👍');
});
