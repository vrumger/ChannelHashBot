import { TBot } from '../typings';

import channelPost from './channelPost';
import hashtag from './hashtag';
import help from './help';
import likes from './likes';
import newMember from './newMember';
import settings from './settings';
import tags from './tags';
import unwatch from './unwatch';
import watch from './watch';

export default (bot: TBot): void => {
    help(bot);
    channelPost(bot);
    newMember(bot);
    settings(bot);
    watch(bot);
    unwatch(bot);
    tags(bot);
    hashtag(bot);
    likes(bot);
};
