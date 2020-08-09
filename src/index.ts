import path from 'path';
import NeDB from 'nedb';
import Telegraf from 'telegraf';
import dotenv from 'dotenv';

import addHandlers from './handlers';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN as string);

const db = {
    channels: new NeDB({
        filename: path.join(__dirname, `../stores/channels.db`),
        autoload: true,
    }),
    groups: new NeDB({
        filename: path.join(__dirname, `../stores/chats.db`),
        autoload: true,
    }),
    messages: new NeDB({
        filename: path.join(__dirname, `../stores/messages.db`),
        autoload: true,
    }),
    likes: new NeDB({
        filename: path.join(__dirname, `../stores/likes.db`),
        autoload: true,
    }),
};

bot.catch(console.error);

bot.use((ctx, next) => {
    if (!ctx.from || ctx.from.id !== 777000) next();
});

addHandlers(bot, db);

bot.launch().then(() => {
    console.log(`@${bot.options.username} is running...`);
});
