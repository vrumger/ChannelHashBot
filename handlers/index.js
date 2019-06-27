const handlers = [
    `channelPost`,
    `newMember`,
    `settings`,
    `watch`,
    `unwatch`,
    `tags`,
    `hashtag`,
];

module.exports = (bot, db) =>
    handlers.forEach(handler => require(`./${handler}`)(bot, db));
