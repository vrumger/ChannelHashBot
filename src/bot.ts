import CustomContext from './context';
import { Telegraf } from 'telegraf';

export const bot = new Telegraf(process.env.BOT_TOKEN as string, {
    contextType: CustomContext,
});

bot.catch(console.error);

bot.use((ctx, next) => {
    if (!ctx.from || ctx.from.id !== 777000) next();
});
