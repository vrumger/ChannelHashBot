import { Composer, Context, InlineKeyboard } from 'grammy';
import { GroupTags, Channel as IChannel, Group as IGroup } from '../typings/db';
import Channel from '../models/channel';
import Group from '../models/group';
import { Message as TMessage } from '@grammyjs/types';

const composer = new Composer();

const sendChannelSelection = async (ctx: Context, message: TMessage) => {
    if (!ctx.chat || !ctx.from) {
        return;
    }

    const { chat, from } = ctx;
    const { message_id, text, entities } = message;
    const hashtags = (entities || []).filter(
        entity => entity.type === 'hashtag',
    );

    if (hashtags.length === 0) {
        await ctx.reply('You need to specify a hashtag with the `#`.', {
            parse_mode: 'Markdown',
        });
        return;
    }

    const tags = hashtags
        .map(entity =>
            text!.slice(entity.offset, entity.offset + entity.length),
        )
        .join(', ');

    let channels: IChannel[] | null;
    try {
        channels = await Channel.find({
            admins: { $elemMatch: { $eq: from.id } },
        });
    } catch (err) {
        console.error(err);
        await ctx.reply('There was an error.');
        return;
    }

    const inlineKeyboard = channels
        .reduce(
            (keyboard, channel) =>
                keyboard
                    .text(
                        channel.title,
                        `${from.id}:${chat.id}:${channel.chat_id}`,
                    )
                    .row(),
            new InlineKeyboard(),
        )
        .text('My Private Messages 🗨', `${from.id}:${chat.id}:${from.id}`)
        .row()
        .text('Done 👍', `${from.id}:done`);

    await ctx.reply(`Choose a channel for the following tags:\n${tags}`, {
        reply_to_message_id: message_id,
        reply_markup: inlineKeyboard,
    });
};

composer.command('watch', async ctx => {
    if (
        !ctx.chat ||
        !['group', 'supergroup'].includes(ctx.chat.type) ||
        !ctx.from ||
        ctx.senderChat?.type === 'channel'
    ) {
        return;
    }

    if (ctx.msg.sender_chat?.id === ctx.chat.id) {
        const me = await ctx.getChatMember(ctx.me.id);

        if (me.status === 'administrator') {
            await ctx.reply(
                "Who are you again? Oh, you're anonymous. Click this magical button so I can find your channels.",
                {
                    reply_to_message_id: ctx.msg.message_id,
                    allow_sending_without_reply: true,
                    reply_markup: new InlineKeyboard().text(
                        'Click here',
                        'anon-watch',
                    ),
                },
            );
        } else {
            await ctx.reply(
                "It looks like you're anonymous. You need to make me admin so I can figure out what channels you have.",
            );
        }

        return;
    }

    const user = await ctx.getAuthor();

    if (!['creator', 'administrator'].includes(user.status)) {
        return;
    }

    await sendChannelSelection(ctx, ctx.msg);
});

composer.callbackQuery('anon-watch', async ctx => {
    const user = await ctx.getAuthor();

    if (!['creator', 'administrator'].includes(user.status)) {
        await ctx.answerCallbackQuery({ text: 'Who are you again?' });
        return;
    }

    if (!ctx.msg?.reply_to_message) {
        await ctx.answerCallbackQuery({
            text: "I don't know what hashtags you want. 🤔",
        });
        await ctx.deleteMessage();
        return;
    }

    await sendChannelSelection(ctx, ctx.msg.reply_to_message);
    await ctx.deleteMessage();
    await ctx.answerCallbackQuery();
});

composer.callbackQuery(/^(\d+):(-\d+):(-?\d+)$/, async ctx => {
    const from = Number(ctx.match![1]);
    const group = Number(ctx.match![2]);
    const channel = Number(ctx.match![3]);

    if (from !== ctx.from.id) {
        await ctx.answerCallbackQuery({ text: '😒' });
        return;
    } else if (!ctx.msg) {
        return;
    }

    const { text, entities } = ctx.msg;

    const hashtags = (entities || [])
        .filter(entity => entity.type === 'hashtag')
        .map(entity =>
            text
                ? text.slice(entity.offset + 1, entity.offset + entity.length)
                : '',
        );

    let chat: IGroup | null;
    try {
        chat = await Group.findOne({ chat_id: group });
    } catch (err) {
        console.error(err);
        await ctx.answerCallbackQuery({ text: '🚫' });
        return;
    }

    if (!chat) {
        chat = new Group({ chat_id: group, tags: {} });
    } else if (!chat.tags) {
        chat.tags = {};
    }

    const tagsObject = hashtags.reduce(
        (tags: GroupTags, hashtag) => {
            if (!tags[hashtag]) {
                tags[hashtag] = [];
            } else if (!Array.isArray(tags[hashtag])) {
                // Convert to array for backwards compatibility
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                tags[hashtag] = [tags[hashtag]];
            }

            // Append and filter duplicates
            tags[hashtag] = [...new Set(tags[hashtag].concat(channel))];
            return tags;
        },
        { ...chat.tags },
    );

    chat.tags = tagsObject;
    await chat.save();

    await ctx.answerCallbackQuery({ text: '👍' });
});

composer.callbackQuery(/^(\d+):done$/, async ctx => {
    if (!ctx.msg) {
        return;
    }

    const message_id = ctx.msg.reply_to_message?.message_id;
    const from = Number(ctx.match![1]);

    if (from !== ctx.from?.id) {
        await ctx.answerCallbackQuery({ text: '😒' });
        return;
    }

    await ctx.answerCallbackQuery({ text: '👍' });
    await ctx.deleteMessage();

    if (message_id) {
        await ctx.api.deleteMessage(ctx.msg.chat.id, message_id).catch(() => {
            // Ignore error
        });
    }
});

export default composer;
