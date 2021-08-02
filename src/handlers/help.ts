import { Composer } from 'grammy';

const composer = new Composer();

const start =
    'Hi, I was made to help you keep track of hashtags that are sent to your group by sending them to a channel. ' +
    'To learn my commands, send /help and for a step-by-step guide on how to set me up, send /setup.';

const help = `
<code>/watch [hashtags...]</code> - add hashtags to your watchlist
<code>/unwatch [hashtags...]</code> - remove tags from your watchlist
<code>/tags</code> - get a list of the hashtags in your watchlist and its destination
<code>/settings</code> - change your groups configuration
`;

const setup = `
<b>To set up a channel:</b>
1. Add me to a channel
2. Send <code>/connect</code> to your channel

<b>To set up a group:</b>
1. Add me to a group
2. Send <code>/watch #hashtag1 #hashtag2 ...</code>
3. Choose a channel from the buttons
4. (Optional) send <code>/settings</code> to configure me
`;

composer
    .filter(ctx => ctx.chat?.type === 'private')
    .command('start', ctx => ctx.reply(start))
    .command('help', ctx => ctx.reply(help, { parse_mode: 'HTML' }))
    .command('setup', ctx => ctx.reply(setup, { parse_mode: 'HTML' }));

export default composer;
