import { GroupSettings, Group as IGroup } from '../typings/db';
import { ExtraReplyMessage } from 'telegraf/typings/telegram-types';
import Group from '../models/group';
import { TBot } from '../typings';
import adminMiddleware from '../middleware/admin';
import escapeHtml from '@youtwitface/escape-html';

const messageErrors = [
    'Forbidden: bot can\'t initiate conversation with a user',
    'Forbidden: bot was blocked by the user',
];

export default (bot: TBot): void => {
    const button = (
        text: string,
        chatId: number,
        data: string,
        enabled: boolean,
    ) => [
        {
            text: `${text} ${enabled ? '✅' : '❌'}`,
            callback_data: `settings:${chatId}:${data}:${enabled}`,
        },
    ];

    const generateMarkup = (chat: IGroup) => {
        const forwards = chat.settings!.forwards !== false; // Default true
        const link = chat.settings!.link === true; // Default false
        const comments = chat.settings!.comments === true; // Default false
        const likes = chat.settings!.likes === true; // Default false

        return {
            inline_keyboard: [
                button('Forwards', chat.chat_id, 'forwards', forwards),
                button('Direct Link', chat.chat_id, 'link', link),
                button('Comments', chat.chat_id, 'comments', comments),
                button('Likes', chat.chat_id, 'likes', likes),
            ],
        };
    };

    bot.command('settings', adminMiddleware(), async ctx => {
        if (!ctx.chat!.type.includes('group')) return;

        const { id: chat_id } = ctx.chat!;

        let chat: IGroup | null;
        try {
            chat = await Group.findOne({ chat_id });
        } catch (err) {
            console.error(err);
            ctx.reply('There was an error.');
            return;
        }

        if (!chat) {
            chat = new Group({ chat_id, settings: {} });
        } else if (!chat.settings) {
            chat.settings = {};
        }

        const chatTitle = escapeHtml(ctx.chat!.title!);
        const chatLink = ctx.chat!.username
            ? `<a href="https://t.me/${ctx.chat!.username}">${chatTitle}</a>`
            : chatTitle;
        const message = `Use the buttons below to configure ${ctx.me}'s behavior for ${chatLink}.`;
        const messageOptions: ExtraReplyMessage = {
            reply_markup: generateMarkup(chat),
            disable_web_page_preview: true,
            parse_mode: 'HTML',
        };

        try {
            await ctx.telegram.sendMessage(
                ctx.from!.id,
                message,
                messageOptions,
            );
            ctx.deleteMessage().catch(() => {
                // Ignore error
            });
        } catch (err) {
            if (messageErrors.includes(err.description)) {
                ctx.reply(message, messageOptions);
            } else {
                console.error(err);
            }
        }
    });

    bot.action(
        /^settings:(-\d+):([^:]+):(true|false)$/,
        adminMiddleware(true),
        async ctx => {
            const [, chatId, setting, bool] = ctx.match!;
            const chat_id = Number(chatId);

            const isAdmin = await ctx.isAdmin!(chat_id, ctx.from!.id);

            if (!isAdmin) {
                ctx.answerCbQuery('You are not admin in this group.');
                return ctx.deleteMessage();
            }

            let chat: IGroup | null;
            try {
                chat = await Group.findOne({ chat_id });
            } catch (err) {
                console.error(err);
                ctx.answerCbQuery('There was an error.');
                return;
            }

            if (!chat) {
                chat = new Group({ chat_id, settings: {} });
            } else if (!chat.settings) {
                chat.settings = {};
            }

            const _settings: GroupSettings = { ...chat.settings };
            _settings[setting as keyof GroupSettings] = bool !== 'true';

            chat.settings = _settings;
            await chat.save();

            ctx.editMessageReplyMarkup(generateMarkup(chat));
        },
    );
};
