import { Database, TBot } from '../typings';

import channelPost from './channelPost';
import hashtag from './hashtag';
import help from './help';
import likes from './likes';
import newMember from './newMember';
import settings from './settings';
import tags from './tags';
import unwatch from './unwatch';
import watch from './watch';

export default (bot: TBot, db: Database): void => {
    help(bot, db);
    channelPost(bot, db);
    newMember(bot, db);
    settings(bot, db);
    watch(bot, db);
    unwatch(bot, db);
    tags(bot, db);
    hashtag(bot, db);
    likes(bot, db);
};
