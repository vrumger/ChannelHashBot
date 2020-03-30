require(`dotenv`).config();

const path = require(`path`);
const NeDB = require(`nedb`);
const Telegraf = require(`telegraf`);
const bot = new Telegraf(process.env.BOT_TOKEN);

const db = {
    channels: new NeDB({
        filename: path.join(__dirname, `stores/channels.db`),
        autoload: true,
    }),
    groups: new NeDB({
        filename: path.join(__dirname, `stores/chats.db`),
        autoload: true,
    }),
    messages: new NeDB({
        filename: path.join(__dirname, `stores/messages.db`),
        autoload: true,
    }),
    likes: new NeDB({
        filename: path.join(__dirname, `stores/likes.db`),
        autoload: true,
    }),
};

bot.catch(console.error);

bot.use((ctx, next) => {
    if (!ctx.from || ctx.from.id !== 777000) next();
});

require(`./handlers`)(bot, db);

bot.launch();
