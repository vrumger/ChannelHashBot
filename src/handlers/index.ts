import { addChannel, finishAddingChannels, watch } from './watch';
import { applySetting, settings } from './settings';
import { channels, reloadChannel } from './listChannels';
import { editedMessage, hashtag } from './hashtag';
import { help, setup, start } from './help';
import { bot } from '../bot';
import { channelPost } from './channelPost';
import { likes } from './likes';
import { newChatMembers } from './newMember';
import { tags } from './tags';
import { unwatch } from './unwatch';

export const initHandlers = (): void => {
    // watch.ts
    bot.use(watch);
    bot.use(addChannel);
    bot.use(finishAddingChannels);

    // unwatch.ts
    bot.use(unwatch);

    // tags.ts
    bot.use(tags);

    // settings.ts
    bot.use(settings);
    bot.use(applySetting);

    // newMember,ts
    bot.use(newChatMembers);

    // listChannels.ts
    bot.use(channels);
    bot.use(reloadChannel);

    // likes.ts
    bot.use(likes);

    // help.ts
    bot.use(start);
    bot.use(help);
    bot.use(setup);

    // hashtag.js
    bot.use(hashtag);
    bot.use(editedMessage);

    // channelPost.js
    bot.use(channelPost);
};
