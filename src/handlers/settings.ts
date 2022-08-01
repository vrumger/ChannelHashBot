import { Composer, Context, GrammyError, InlineKeyboard, RawApi } from 'grammy';
import { GroupSettings, Group as IGroup } from '../typings/db';
import { Chat } from '@grammyjs/types';
import Group from '../models/group';
import { Other } from 'grammy/out/core/api';
import escapeHtml from '@youtwitface/escape-html';

const composer = new Composer();

// TODO: remove this
const messageErrors = [
    // prettier-ignore
    'Forbidden: bot can\'t initiate conversation with a user',
    'Forbidden: bot was blocked by the user',
];

const generateMarkup = (chat: IGroup) => {
    const buttonText = (text: TemplateStringsArray, enabled: boolean) =>
        `${text.join('')}${enabled ? '✅' : '❌'}`;
    const buttonData = (data: string, enabled: boolean) =>
        `settings:${chat.chat_id}:${data}:${enabled}`;

    const forwards = chat.settings!.forwards !== false; // Default true
    const link = chat.settings!.link === true; // Default false
    const comments = chat.settings!.comments === true; // Default false
    const likes = chat.settings!.likes === true; // Default false

    return new InlineKeyboard()
        .text(
            buttonText`Forwards ${forwards}`,
            buttonData('forwards', forwards),
        )
        .row()
        .text(buttonText`Direct Link ${link}`, buttonData('link', link))
        .row()
        .text(
            buttonText`Comments ${comments}`,
            buttonData('comments', comments),
        )
        .row()
        .text(buttonText`Likes ${likes}`, buttonData('likes', likes));
};

const updateSettings = (
    newSetting: keyof GroupSettings,
    settings: GroupSettings,
): GroupSettings => {
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

const sendSettings = async (ctx: Context, recipient: number) => {
    const chat = ctx.chat as Chat.GroupChat | Chat.SupergroupChat;

    let dbChat: IGroup | null;
    try {
        dbChat = await Group.findOne({ chat_id: chat.id });
    } catch (err) {
        console.error(err);
        return 'There was an error.';
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
    const message = `Use the buttons below to configure ${ctx.me.username}'s behavior for ${chatLink}.`;
    const messageOptions: Other<RawApi, 'sendMessage', 'chat_id' | 'text'> = {
        reply_markup: generateMarkup(dbChat),
        disable_web_page_preview: true,
        parse_mode: 'HTML',
    };

    try {
        await ctx.api.sendMessage(recipient, message, messageOptions);
    } catch (err) {
        if (
            err instanceof GrammyError &&
            messageErrors.includes(err.description)
        ) {
            await ctx.reply(message, messageOptions);
        } else {
            console.error(err);
        }
    }
};

composer.command('settings', async ctx => {
    if (
        !ctx.chat ||
        !['group', 'supergroup'].includes(ctx.chat.type) ||
        !ctx.from ||
        ctx.senderChat?.type === 'channel'
    ) {
        return;
    } else if (ctx.msg.sender_chat?.id === ctx.chat.id) {
        const me = await ctx.getChatMember(ctx.me.id);

        if (me.status === 'administrator') {
            await ctx.reply(
                'Who are you again? Oh, you\'re anonymous. Click this magical button so I can send you the settings.',
                {
                    reply_to_message_id: ctx.msg.message_id,
                    allow_sending_without_reply: true,
                    reply_markup: new InlineKeyboard().text(
                        'Click here',
                        'anon-settings',
                    ),
                },
            );
        } else {
            await ctx.reply(
                'It looks like you\'re anonymous. You need to make me admin so I can figure out where to send the settings.',
            );
        }

        return;
    }

    const response = await sendSettings(ctx, ctx.from.id);

    if (response) {
        await ctx.reply(response);
    }

    await ctx.deleteMessage().catch(() => {
        // Ignore error
    });
});

composer.callbackQuery('anon-settings', async ctx => {
    const user = await ctx.getAuthor();

    if (!['creator', 'administrator'].includes(user.status)) {
        await ctx.answerCallbackQuery({ text: 'Who are you again?' });
        return;
    }

    const response = await sendSettings(ctx, user.user.id);

    await ctx.answerCallbackQuery({ text: response });
    await ctx.deleteMessage().catch(() => {
        // Ignore error
    });

    if (ctx.msg?.reply_to_message) {
        await ctx.api
            .deleteMessage(ctx.msg.chat.id, ctx.msg.reply_to_message.message_id)
            .catch(() => {
                // Ignore error
            });
    }
});

composer.callbackQuery(/^settings:(-\d+):([^:]+):(true|false)$/, async ctx => {
    if (!ctx.chat || !ctx.from) {
        return;
    }

    const [, chatId, setting, bool] = ctx.match!;
    const chat_id = Number(chatId);

    const user = await ctx.api.getChatMember(chatId, ctx.from.id);

    if (!['creator', 'administrator'].includes(user.status)) {
        await ctx.answerCallbackQuery({
            text: 'You are not admin in this group.',
        });

        if (ctx.chat.type === 'private') {
            await ctx.deleteMessage();
        }

        return;
    }

    let chat: IGroup | null;
    try {
        chat = await Group.findOne({ chat_id });
    } catch (err) {
        console.error(err);
        await ctx.answerCallbackQuery({ text: 'There was an error.' });
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

    await ctx.editMessageReplyMarkup({ reply_markup: generateMarkup(chat) });
    await ctx.answerCallbackQuery();
});

export default composer;
