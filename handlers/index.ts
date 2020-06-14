import { TBot, Database } from '../typings';

import help from './help';
import channelPost from './channelPost';
import newMember from './newMember';
import settings from './settings';
import watch from './watch';
import unwatch from './unwatch';
import tags from './tags';
import hashtag from './hashtag';
import likes from './likes';

export default (bot: TBot, db: Database) => {
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
