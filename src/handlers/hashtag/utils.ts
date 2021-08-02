import { Context, InlineKeyboard } from 'grammy';
import { MessageEntity, Message as TMessage } from '@grammyjs/types';
import { Group as IGroup } from '../../typings/db';
import { formatLikeKeyboard } from '../../utils';

export interface HashtagHandler {
    (
        ctx: Context,
        message: TMessage,
        entities: MessageEntity[],
        text: string,
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
    entities,
}: {
    ctx: Context;
    chat: IGroup;
    channelID: number;
    message: TMessage;
    text: string;
    entities: MessageEntity[];
}): Promise<TMessage> => {
    // Use `!== false` in case it's `undefined`
    if (!chat.settings || chat.settings.forwards !== false) {
        return await ctx.api.forwardMessage(
            channelID,
            message.chat.id,
            message.message_id,
        );
    }

    // const channel = await Channel.findOne({ chat_id: channelID });
    const chatId = message.chat.id.toString().slice(4);
    const directLink =
        'username' in message.chat && message.chat.username
            ? message.chat.username
            : `c/${chatId}`;

    const replyMarkup = getReplyMarkup({
        chat,
        directLink,
        message_id: message.message_id,
    });

    if (message.audio) {
        return await ctx.api.sendAudio(channelID, message.audio.file_id, {
            reply_markup: replyMarkup,
            caption: text,
            caption_entities: entities,
        });
    } else if (message.document) {
        return await ctx.api.sendDocument(channelID, message.document.file_id, {
            reply_markup: replyMarkup,
            caption: text,
            caption_entities: entities,
        });
    } else if (message.photo) {
        // TODO: add a link to discussion group
        // if (chat.settings.comments) {
        //     await ctx.createComment!(
        //         parsedMessage,
        //         channel?.admins || [],
        //         options,
        //     );
        // }

        const photos = [...message.photo];
        const fileId = photos.pop()!.file_id;

        return await ctx.api.sendPhoto(channelID, fileId, {
            reply_markup: replyMarkup,
            caption: text,
            caption_entities: entities,
        });
    } else if (message.video) {
        return await ctx.api.sendVideo(channelID, message.video.file_id, {
            reply_markup: replyMarkup,
            caption: text,
            caption_entities: entities,
        });
    } else {
        // TODO: add a link to discussion group
        // if (chat.settings.comments) {
        //     await ctx.createComment!(
        //         parsedMessage,
        //         channel?.admins || [],
        //         options,
        //     );
        // }

        return await ctx.api.sendMessage(channelID, text, {
            reply_markup: replyMarkup,
            entities,
        });
    }
};
