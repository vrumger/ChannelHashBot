import { Channel, Chat, Like, Message } from './db';
import { ExtraReplyMessage } from 'telegraf/typings/telegram-types';
import Telegraf from 'telegraf';
import { TelegrafContext } from 'telegraf/typings/context';

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
    downloadPhoto?: () => Promise<Buffer>;
    createComment?: (text: string, options: ExtraReplyMessage) => void;
}

export type TNext = () => Promise<void>;
