const adminMiddleware = require(`../middleware/admin`);

module.exports = (bot, db) => {
    const button = (text, data, state) => [
        {
            text: `${text} ${state ? `✅` : `❌`}`,
            callback_data: `settings:${data}:${state}`,
        },
    ];

    const generateMarkup = chat => {
        const forwards = chat.settings.forwards !== false; // Default true
        const link = chat.settings.link === true; // Default false
        const comments = chat.settings.comments === true; // Default false
        const likes = chat.settings.likes === true; // Default false

        return {
            inline_keyboard: [
                button(`Forwards`, `forwards`, forwards),
                button(`Direct Link`, `link`, link),
                button(`Comments`, `comments`, comments),
                button(`Likes`, `likes`, likes),
            ],
        };
    };

    bot.command(`settings`, adminMiddleware, ctx => {
        if (!ctx.chat.type.includes(`group`)) return;

        db.groups.findOne({ chat_id: ctx.chat.id }, (err, chat) => {
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

            ctx.reply(
                `Use the buttons below to configure ${
                    ctx.me
                }'s behavior for this group.`,
                { reply_markup: generateMarkup(chat) }
            );
        });
    });

    bot.action(/^settings:([^:]+):(true|false)$/, adminMiddleware, ctx => {
        const [, setting, bool] = ctx.match;

        db.groups.findOne({ chat_id: ctx.chat.id }, (err, chat) => {
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

            chat.settings[setting] = bool !== `true`;

            db.groups.update(
                { chat_id: ctx.chat.id },
                { $set: { settings: chat.settings } },
                { upsert: true }
            );

            ctx.editMessageReplyMarkup(generateMarkup(chat));
        });
    });
};
