import { Group as IGroup, Message as IMessage } from '../typings/db';
import { Composer } from 'grammy';
import Group from '../models/group';
import Message from '../models/message';
import { countLikes } from '../utils';
import { getReplyMarkup } from './hashtag/utils';

const composer = new Composer();

composer
    .filter(ctx => ctx.senderChat?.type === 'channel')
    .on('message', async ctx => {
        if (ctx.msg.forward_from_message_id) {
            let chat: IGroup | null;
            try {
                chat = await Group.findOne({ chat_id: ctx.chat.id });
            } catch (err) {
                console.error(err);
                return;
            }

            if (!chat) {
                return;
            }

            let message: IMessage | null;
            try {
                message = await Message.findOne({
                    channel_id: ctx.senderChat!.id,
                    channel_message_id: ctx.msg.forward_from_message_id,
                });
            } catch (err) {
                console.error(err);
                return;
            }

            if (!message) {
                return;
            }

            const chatId = ctx.msg.chat.id.toString().slice(4);
            const directLink =
                'username' in ctx.chat && ctx.chat.username
                    ? ctx.chat.username
                    : `c/${chatId}`;

            const [plus, minus] = await countLikes(
                ctx.senderChat!.id,
                ctx.msg.forward_from_message_id,
            );

            const replyMarkup = getReplyMarkup({
                chat,
                directLink,
                commentsLink: `https://t.me/c/${chatId}/1?thread=${ctx.msg.message_id}`,
                message_id: message.message_id,
                plus,
                minus,
            });

            await ctx.api.editMessageReplyMarkup(
                ctx.senderChat!.id,
                ctx.msg.forward_from_message_id,
                { reply_markup: replyMarkup },
            );
        }
    });

export default composer;
