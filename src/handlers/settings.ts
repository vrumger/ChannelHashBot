import { Chat, ExtraReplyMessage } from 'telegraf/typings/telegram-types';
import { GroupSettings, Group as IGroup } from '../typings/db';
import { Composer } from 'telegraf';
import CustomContext from '../context';
import Group from '../models/group';
import escapeHtml from '@youtwitface/escape-html';

const messageErrors = [
    // prettier-ignore
    'Forbidden: bot can\'t initiate conversation with a user',
    'Forbidden: bot was blocked by the user',
];

const button = (text: string, chatId: number, data: string, enabled: boolean) => [
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

const updateSettings = (newSetting: keyof GroupSettings, settings: GroupSettings): GroupSettings => {
    const newSettings = { ...settings };

    if (newSetting === 'forwards' && settings.forwards) {
        newSettings.comments = false;
        newSettings.likes = false;
        newSettings.link = false;
    } else {
        newSettings.forwards = false;
    }

    return newSettings;
};

export const settings = Composer.command<CustomContext>(
    'settings',
    Composer.groupChat(
        Composer.admin(async ctx => {
            const chat = ctx.message.chat as Chat.GroupChat | Chat.SupergroupChat;
            const { from } = ctx.message;

            let dbChat: IGroup | null;
            try {
                dbChat = await Group.findOne({ chat_id: chat.id });
            } catch (err) {
                console.error(err);
                ctx.reply('There was an error.');
                return;
            }

            if (!dbChat) {
                dbChat = new Group({ chat_id: chat.id, settings: {} });
            } else if (!dbChat.settings) {
                dbChat.settings = {};
            }

            const chatTitle = escapeHtml(chat.title);
            const chatLink =
                'username' in chat && chat.username
                    ? `<a href="https://t.me/${chat.username}">${chatTitle}</a>`
                    : chatTitle;
            const message = `Use the buttons below to configure ${ctx.me}'s behavior for ${chatLink}.`;
            const messageOptions: ExtraReplyMessage = {
                reply_markup: generateMarkup(dbChat),
                disable_web_page_preview: true,
                parse_mode: 'HTML',
            };

            try {
                await ctx.telegram.sendMessage(from.id, message, messageOptions);
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
        }),
    ),
);

export const applySetting = Composer.action<CustomContext>(
    /^settings:(-\d+):([^:]+):(true|false)$/,
    Composer.admin(async ctx => {
        if (!ctx.from) return;

        const [, chatId, setting, bool] = ctx.match;
        const chat_id = Number(chatId);

        const isAdmin = await ctx.isAdmin(chat_id, ctx.from.id);

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

        chat.settings = updateSettings(setting as keyof GroupSettings, _settings);
        await chat.save();

        ctx.editMessageReplyMarkup(generateMarkup(chat));
    }),
);
