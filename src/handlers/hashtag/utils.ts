import { Context, InlineKeyboard } from 'grammy';
import { MessageEntity, MessageId, Message as TMessage } from '@grammyjs/types';
import { Group as IGroup } from '../../typings/db';
import { formatLikeKeyboard } from '../../utils';

export interface HashtagHandler {
    (
        ctx: Context,
        message: TMessage,
        entities: MessageEntity[],
        text: string,
        textIsCaption: boolean,
        hashtagEntities: MessageEntity[],
        tags: string[],
    ): Promise<void>;
}

export const getReplyMarkup = ({
    chat,
    directLink,
    commentsLink,
    message_id,
    plus = 0,
    minus = 0,
}: {
    chat: IGroup;
    directLink: string;
    commentsLink?: string;
    message_id: number;
    plus?: number;
    minus?: number;
}): InlineKeyboard => {
    const keyboard = new InlineKeyboard();

    if (chat.settings?.likes) {
        formatLikeKeyboard(plus, minus).inline_keyboard.forEach(row =>
            keyboard.add(...row).row(),
        );
    }

    if (chat.settings?.link) {
        keyboard
            .url('Go to message', `https://t.me/${directLink}/${message_id}`)
            .row();
    }

    // Don't show the comments link if there are no other buttons so the Telegram app can show it
    if (
        chat.settings?.comments &&
        keyboard.inline_keyboard.length > 0 &&
        commentsLink
    ) {
        keyboard.url('View Comments', commentsLink).row();
    }

    return keyboard;
};

export const sendMessage = async ({
    ctx,
    chat,
    channelID,
    message,
    text,
    textIsCaption,
}: {
    ctx: Context;
    chat: IGroup;
    channelID: number;
    message: TMessage;
    text: string;
    textIsCaption: boolean;
}): Promise<MessageId> => {
    // Use `!== false` in case it's `undefined`
    if (!chat.settings || chat.settings.forwards !== false) {
        return await ctx.api.forwardMessage(
            channelID,
            message.chat.id,
            message.message_id,
        );
    }

    const chatId = message.chat.id.toString().slice(4);
    const directLink =
        'username' in message.chat && message.chat.username
            ? message.chat.username
            : `c/${chatId}`;

    const addReplyMarkup = text.length <= (textIsCaption ? 1024 : 4096);
    const replyMarkup = getReplyMarkup({
        chat,
        directLink,
        message_id: message.message_id,
    });

    const copiedMessage = await ctx.api.copyMessage(
        channelID,
        message.chat.id,
        message.message_id,
        addReplyMarkup ? { reply_markup: replyMarkup } : undefined,
    );

    if (!addReplyMarkup) {
        await ctx.api.editMessageReplyMarkup(
            channelID,
            copiedMessage.message_id,
            { reply_markup: replyMarkup },
        );
    }

    return copiedMessage;
};
