import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

// eslint-disable-next-line sort-imports
import { bot } from './bot';
import { initHandlers } from './handlers';

(async () => {
    await mongoose.connect(process.env.MONGO_URI as string, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useCreateIndex: true,
    });

    console.log('Connected to MongoDB');

    initHandlers();

    await bot.launch();
    console.log(`@${bot.botInfo?.username} is running...`);
})();
