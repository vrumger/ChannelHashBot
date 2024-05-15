import { Context, InlineKeyboard } from 'grammy';
import { InlineKeyboardButton, Message, MessageEntity } from '@grammyjs/types';
import { FilterQuery } from 'mongoose';
import { Like as ILike } from './typings/db';
import Like from './models/like';
import { actionMap } from './handlers/likes';

export function getText(msg: Message | undefined): string | undefined {
    if (msg == null) return undefined;
    if ('caption' in msg) return msg.caption;
    if ('text' in msg) return msg.text;
    return undefined;
}

export function getEntities(msg: Message | undefined): MessageEntity[] {
    if (msg == null) return [];
    if ('caption_entities' in msg) return msg.caption_entities ?? [];
    if ('entities' in msg) return msg.entities ?? [];
    return [];
}

export const handleError = async (
    ctx: Context,
    error: Error | unknown,
): Promise<boolean> => {
    if (error) {
        console.error(error);
        await ctx.answerCallbackQuery({ text: '🚫 There was an error.' });
        return true;
    }

    return false;
};

const _countLikes = (query: FilterQuery<ILike>): Promise<number> =>
    new Promise((resolve, reject) => {
        Like.countDocuments(query, (error, likes) => {
            if (error) {
                reject(error);
            } else {
                resolve(likes);
            }
        });
    });

export const countLikes = (
    chat_id: number,
    message_id: number,
): Promise<[number, number]> =>
    Promise.all([
        _countLikes({ chat_id, message_id, action: '+' }),
        _countLikes({ chat_id, message_id, action: '-' }),
    ]);

export const formatLikeKeyboard = (
    plus: number,
    minus: number,
    extra?: InlineKeyboardButton[][],
): InlineKeyboard => {
    const keyboard = new InlineKeyboard()
        .text(
            plus === 0 && minus === 0
                ? actionMap['+']
                : `${actionMap['+']} (${plus})`,
            '+1',
        )
        .text(
            plus === 0 && minus === 0
                ? actionMap['-']
                : `${actionMap['-']} (${minus})`,
            '-1',
        )
        .row();

    if (extra) {
        return extra.reduce((k, r) => k.add(...r).row(), keyboard);
    }

    return keyboard;
};

// returns an array where the first item is the object with all the keys lowercase
// and the second item is a map of the lowercase keys to the original keys
export const lowerCaseObject = <T extends { [k: string]: unknown }>(
    object: T,
): [T, { [k: string]: string }] => {
    return Object.entries(object).reduce<[T, { [k: string]: string }]>(
        ([result, keyMap], [key, value]) => {
            const lowerCaseKey = key.toLowerCase();

            result[lowerCaseKey as keyof T] = value as T[keyof T];
            keyMap[lowerCaseKey] = key;

            return [result, keyMap];
        },
        [{} as T, {} as { [k: string]: string }],
    );
};
