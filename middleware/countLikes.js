const { promisify } = require(`util`);

module.exports = db => {
    const countLikes = promisify(db.likes.count.bind(db.likes));

    return (chat_id, message_id) =>
        Promise.all([
            countLikes({ chat_id, message_id, action: `+` }),
            countLikes({ chat_id, message_id, action: `-` }),
        ]);
};
