const { Composer } = require(`telegraf`);

const start = `<i>Hi there, Dear BookCrush member!</i>\n
You will receive notifications from me when your request is fulfilled! (make sure the bot is not stopped or blocked to be able to receive notifications)
\nMore features coming soon!`;

const help = `
<code>/watch [hashtags...]</code> - add hashtags to your watchlist
<code>/unwatch [hashtags...]</code> - remove tags from your watchlist
<code>/tags</code> - get a list of the hashtags in your watchlist and its destination
<code>/settings</code> - change your groups configuration
`;

const setup = `
<b>To set up a channel:</b>
1. Add me to a channel
2. Send <code>@BookCrushMgrBot</code> to your channel

<b>To set up a group:</b>
1. Add me to a group
2. Send <code>/watch #hashtag1 #hashtag2 ...</code>
3. Choose a channel from the buttons
4. (Optional) send <code>/settings</code> to configure me
`;

const extra = {
    parse_mode: `html`,
};

module.exports = bot => {
    bot.start(Composer.privateChat(Composer.reply(start, extra)));
    bot.help(Composer.privateChat(Composer.reply(help, extra)));
    bot.command(`setup`, Composer.privateChat(Composer.reply(setup, extra)));
};
