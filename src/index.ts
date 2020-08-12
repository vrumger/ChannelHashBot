import Telegraf from 'telegraf';
import addHandlers from './handlers';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN as string);

bot.catch(console.error);

bot.use((ctx, next) => {
    if (!ctx.from || ctx.from.id !== 777000) next();
});

(async () => {
    await mongoose.connect(process.env.MONGO_URI as string, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useCreateIndex: true,
    });

    console.log('Connected to MongoDB');

    addHandlers(bot);

    await bot.launch();
    console.log(`@${bot.options.username} is running...`);
})();
