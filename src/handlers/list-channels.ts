import { Composer, GrammyError, InlineKeyboard } from 'grammy';
import Channel from '../models/channel';

const composer = new Composer();

const getChannelButtons = async (userId: number) => {
    const channels = await Channel.find({ admins: { $in: [userId] } });

    if (channels.length === 0) {
        return null;
    }

    return channels.reduce(
        (keyboard, channel) =>
            keyboard
                .text(channel.title, `reload:${channel.chat_id}`)
                .text('🔄 Reload admins', `reload:${channel.chat_id}`)
                .row(),
        new InlineKeyboard(),
    );
};

composer.command('channels').filter(
    ctx => ctx.chat.type === 'private',
    async ctx => {
        const from = ctx.from!;
        const buttons = await getChannelButtons(from.id);

        if (buttons === null) {
            await ctx.reply("You don't have any channels.");
            return;
        }

        await ctx.reply(
            "Here's a list of channels that I'm admin in with you.",
            { reply_markup: buttons },
        );
    },
);

composer.callbackQuery(/^reload:(-\d+)$/, async ctx => {
    const { from } = ctx;
    const chatId = Number(ctx.match![1]);

    let admins: number[] = [];
    try {
        admins = (await ctx.api.getChatAdministrators(chatId))
            .map(({ user: { id } }) => id)
            .filter(id => id !== ctx.me.id);
    } catch (error) {
        // TODO: use status codes
        const errors = [
            'Bad Request: chat not found',
            'Bad Request: member list is inaccessible',
            'Forbidden: bot is not a member of the channel chat',
            'Forbidden: bot was kicked from the channel chat',
        ];

        if (
            !(error instanceof GrammyError) ||
            !errors.includes(error.description)
        ) {
            throw error;
        }
    }

    await Channel.updateOne({ chat_id: chatId }, { $set: { admins } });

    if (!admins.includes(from.id)) {
        const buttons = await getChannelButtons(from.id);

        if (buttons === null) {
            await ctx.editMessageText("You don't have any channels.");
        } else {
            await ctx.editMessageReplyMarkup({ reply_markup: buttons });
        }
    }

    await ctx.answerCallbackQuery({ text: 'Updated 👍' });
});

export default composer;
