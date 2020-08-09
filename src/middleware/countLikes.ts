import { Database } from '../typings';

export default (db: Database) => {
    const countLikes = (query: any): Promise<number> =>
        new Promise((resolve, reject) => {
            db.likes.count(query, (error, likes) => (error ? reject(error) : resolve(likes)));
        });

    return (chat_id: number, message_id: number) =>
        Promise.all([
            countLikes({ chat_id, message_id, action: `+` }),
            countLikes({ chat_id, message_id, action: `-` }),
        ]);
};
