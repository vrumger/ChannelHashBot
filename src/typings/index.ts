import { ExtraReplyMessage } from 'telegraf/typings/telegram-types';
import Telegraf from 'telegraf';
import { TelegrafContext } from 'telegraf/typings/context';

export type TBot = Telegraf<TContext>;

export interface TContext extends TelegrafContext {
    handleError?: (error: Error) => boolean;
    isAdmin?: (chatId: number, fromId: number) => Promise<boolean>;
    downloadPhoto?: () => Promise<Buffer>;
    createComment?: (text: string, options: ExtraReplyMessage) => void;
}

export type TNext = () => Promise<void>;
