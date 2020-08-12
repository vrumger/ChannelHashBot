import { Like as ILike } from '../typings/db';
import Like from '../models/like';
import { MongooseFilterQuery } from 'mongoose';

export const countLikes = (
    query: MongooseFilterQuery<
        Pick<ILike, '_id' | 'chat_id' | 'from_id' | 'message_id' | 'action'>
    >,
): Promise<number> =>
    new Promise((resolve, reject) => {
        Like.countDocuments(query, (error, likes) =>
            error ? reject(error) : resolve(likes),
        );
    });

export default (
    chat_id: number,
    message_id: number,
): Promise<[number, number]> =>
    Promise.all([
        countLikes({ chat_id, message_id, action: '+' }),
        countLikes({ chat_id, message_id, action: '-' }),
    ]);
