const escapeHtml = require(`@youtwitface/escape-html`);
const adminMiddleware = require(`../middleware/admin`);

const messageErrors = [
    `Forbidden: bot can't initiate conversation with a user`,
    `Forbidden: bot was blocked by the user`,
];

module.exports = (bot, db) => {
    const button = (text, chatId, data, enabled) => [
        {
            text: `${text} ${enabled ? `✅` : `❌`}`,
            callback_data: `settings:${chatId}:${data}:${enabled}`,
        },
    ];

    const generateMarkup = chat => {
        const forwards = chat.settings.forwards !== false; // Default true
        const link = chat.settings.link === true; // Default false
        const comments = chat.settings.comments === true; // Default false
        const likes = chat.settings.likes === true; // Default false

        return {
            inline_keyboard: [
                button(`Forwards`, chat.chat_id, `forwards`, forwards),
                button(`Direct Link`, chat.chat_id, `link`, link),
                button(`Comments`, chat.chat_id, `comments`, comments),
                button(`Likes`, chat.chat_id, `likes`, likes),
            ],
        };
    };

    bot.command(`settings`, adminMiddleware(), ctx => {
        if (!ctx.chat.type.includes(`group`)) return;

        db.groups.findOne({ chat_id: ctx.chat.id }, async (err, chat) => {
            if (err) {
                console.error(err);
                ctx.reply(`There was an error.`);
                return;
            }

            if (!chat) {
                chat = { settings: {} };
            } else if (!chat.settings) {
                chat.settings = {};
            }

            const chatTitle = escapeHtml(ctx.chat.title);
            const chatLink = ctx.chat.username
                ? `<a href="https://t.me/${ctx.chat.username}">${chatTitle}</a>`
                : chatTitle;
            const message = `Use the buttons below to configure ${ctx.me}'s behavior for ${chatLink}.`;
            const messageOptions = {
                reply_markup: generateMarkup(chat),
                disable_web_page_preview: true,
                parse_mode: `html`,
            };

            try {
                await ctx.telegram.sendMessage(
                    ctx.from.id,
                    message,
                    messageOptions,
                );
                ctx.deleteMessage().catch(() => {});
            } catch (err) {
                if (messageErrors.includes(err.description)) {
                    ctx.reply(message, messageOptions);
                } else {
                    console.error(err);
                }
            }
        });
    });

    bot.action(
        /^settings:(-\d+):([^:]+):(true|false)$/,
        adminMiddleware(true),
        async ctx => {
            const [, _chatId, setting, bool] = ctx.match;
            const chatId = Number(_chatId);

            const isAdmin = await ctx.isAdmin(chatId, ctx.from.id);

            if (!isAdmin) {
                ctx.answerCbQuery(`You are not admin in this group.`);
                return ctx.deleteMessage();
            }

            db.groups.findOne({ chat_id: chatId }, (err, chat) => {
                if (err) {
                    console.error(err);
                    ctx.answerCbQuery(`There was an error.`);
                    return;
                }

                if (!chat) {
                    chat = { settings: {} };
                } else if (!chat.settings) {
                    chat.settings = {};
                }

                chat.settings[setting] = bool !== `true`;

                db.groups.update(
                    { chat_id: chatId },
                    { $set: { settings: chat.settings } },
                    { upsert: true },
                );

                ctx.editMessageReplyMarkup(generateMarkup(chat));
            });
        },
    );
};
