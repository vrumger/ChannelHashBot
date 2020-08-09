import Telegraf from 'telegraf';
import { TelegrafContext } from 'telegraf/typings/context';
import { ExtraReplyMessage } from 'telegraf/typings/telegram-types';
import { Channel, Chat, Message, Like } from './db';

export interface Database {
    channels: Nedb<Channel>;
    groups: Nedb<Chat>;
    messages: Nedb<Message>;
    likes: Nedb<Like>;
}

export type TBot = Telegraf<TContext>;

export interface TContext extends TelegrafContext {
    handleError?: (error: Error) => boolean;
    isAdmin?: (chatId: number, fromId: number) => Promise<boolean>;
    downloadPhoto?: () => any;
    createComment?: (text: string, options: ExtraReplyMessage) => any;
}

export type TNext = () => Promise<void>;
