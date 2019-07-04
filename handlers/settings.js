const adminMiddleware = require(`../middleware/admin`);

module.exports = (bot, db) => {
    const button = (text, data, state) => [
        {
            text: `${text} ${state ? `✅` : `❌`}`,
            callback_data: `settings:${data}:${state}`,
        },
    ];

    const generateMarkup = chat => {
        const settings = chat && chat.settings;
        const forwards = settings && settings.forwards !== false; // Default true
        const link = settings && settings.link === true; // Default false
        const comments = settings && settings.comments === true; // Default false

        return {
            inline_keyboard: [
                button(`Forwards`, `forwards`, forwards),
                button(`Direct Link`, `link`, link),
                button(`Comments`, `comments`, comments),
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
            }

            ctx.reply(
                `Use the buttons below to configure ChannelHashBot's behavior for this group.`,
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

            if (!chat || !chat.settings) {
                chat = { settings: {} };
            }

            chat.settings[setting] = bool !== `true`;

            db.groups.update(
                { chat_id: ctx.chat.id },
                { $set: { settings: chat.settings } }
            );

            ctx.editMessageReplyMarkup(generateMarkup(chat));
        });
    });
};
