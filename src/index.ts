import { Bot } from 'grammy';
import addChannel from './handlers/add-channel';
import { apiThrottler } from '@grammyjs/transformer-throttler';
import discussion from './handlers/discussion';
import dotenv from 'dotenv';
import hashtag from './handlers/hashtag';
import help from './handlers/help';
import likes from './handlers/likes';
import listChannels from './handlers/list-channels';
import mongoose from 'mongoose';
import { run } from '@grammyjs/runner';
import settings from './handlers/settings';
import tags from './handlers/tags';
import unwatch from './handlers/unwatch';
import watch from './handlers/watch';

dotenv.config();

const bot = new Bot(process.env.BOT_TOKEN as string);

bot.catch(err => {
    console.error(`Error while handling update ${err.ctx.update.update_id}:`);
    console.error(err.error);
});

bot.api.config.use(apiThrottler());

bot.use(watch);
bot.use(unwatch);
bot.use(tags);
bot.use(settings);
bot.use(listChannels);
bot.use(likes);
bot.use(help);
bot.use(discussion);
bot.use(hashtag);
bot.use(addChannel);

mongoose
    .connect(process.env.MONGO_URI as string, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useCreateIndex: true,
    })
    .then(() => {
        console.log('Connected to MongoDB');

        run(bot);
        console.log('Bot started');
    });
