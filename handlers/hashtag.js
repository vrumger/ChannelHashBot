// TODO: cleanup

const textToHtml = require(`@youtwitface/text-to-html`);
const commentMiddleware = require(`../middleware/createComment`);
const formatLikeKeyboard = require(`../middleware/formatLikeKeyboard`);
const { actionMap } = formatLikeKeyboard;
const Database = require("@replit/database")
const repldb = new Database()
const requests = new Database()
var originalRequest;

module.exports = (bot, db) => {
  const countLikes = require(`../middleware/countLikes`)(db);

  const getReplyMarkup = ({
    chat,
    directLink,
    message_id,
    plus = 0,
    minus = 0,
  }) => {
    const inlineKeyboard = [];

    if (chat.settings && chat.settings.likes) {
      inlineKeyboard.push(formatLikeKeyboard(plus, minus));
    }

    if (chat.settings && chat.settings.link) {
      inlineKeyboard.push([
        {
          text: `Tag & PM ⚠️`,
          callback_data: `callback_query_notif`,
        },
        {
          text: `Request 📚`,
          url: `https://t.me/${directLink}/${message_id}`,
        },

      ]);
    }

    originalRequest = `https://t.me/${directLink}/${message_id}`;

    return {
      inline_keyboard: inlineKeyboard,
    };
  };

  const getMessage = ctx => {
    const message = ctx.message || ctx.editedMessage;
    var { forward_date, reply_to_message: reply } = message;

    // Use `forward_date` becuase it's always there
    // for every type of forward
    if (forward_date) return;

    let entities = message.entities || message.caption_entities || [];
    let text = message.text || message.caption || ``;

    const hashtagEntities = entities.filter(
      entity => entity.type === `hashtag`,
    );

    const tags = hashtagEntities
      .filter(entity => entity.type === `hashtag`)
      .map(entity =>
        text
          .slice(entity.offset + 1, entity.offset + entity.length)
          .toLowerCase(),
      );

    const untaggedText = hashtagEntities
      .reduce(
        (res, entity) =>
          res.slice(0, entity.offset) +
          res.slice(entity.offset + entity.length),
        text,
      )
      .trim();

    const messageToSend = untaggedText !== `` || !reply ? message : reply;
    text = ctx.from.first_name + `:\n\n` + messageToSend.text || messageToSend.caption || ``;
    entities =
      messageToSend.entities || messageToSend.caption_entities || [];

    const countLikes = require(`../middleware/countLikes`)(db);

    const errorMiddleware = (ctx, next) => {
      ctx.handleError = err => {
        if (err) {
          console.log(err);
          ctx.answerCbQuery(`🚫 There was an error.`);
          return true;
        }
      };

      next();
    };


    return {
      message: messageToSend,
      text,
      entities,
      tags,
    };
  };


  const sendMessage = async (ctx, chat, channel, message, text, entities) => {
    // Use `!== false` in case it's `undefined`
    if (!chat.settings || chat.settings.forwards !== false) {
      return await ctx.telegram.forwardMessage(
        channel,
        ctx.chat.id,
        message.message_id,
      );
    }

    const parsedMessage = textToHtml(text, entities);
    const chatId = ctx.chat.id.toString().slice(4);
    const directLink = ctx.chat.username || `c/${chatId}`;
    originalRequest = `https://t.me/${directLink}/${message.message_id}`;

    requests.set(ctx.from.id, originalRequest).then(() => { });
    console.log("original req = " + originalRequest)

    const options = {
      reply_markup: getReplyMarkup({
        chat,
        directLink,
        message_id: message.message_id,
      }),
      caption: parsedMessage,
      parse_mode: `html`,
    };

    let sentMessage;

    if (message.audio) {
      /*sentMessage = await ctx.telegram.sendAudio(
          channel,
          message.audio.file_id,
          options,
      );*/
      return;
    } else if (message.document) {
      /*sentMessage = await ctx.telegram.sendDocument(
          channel,
          message.document.file_id,
          options,
      );*/
      return;
    } else if (message.photo) {
      /*if (chat.settings.comments) {
          await ctx.createComment(parsedMessage, options);
      }

      sentMessage = await ctx.telegram.sendPhoto(
          channel,
          message.photo.pop().file_id,
          options,
      );*/
      return;
    } else if (message.video) {
      /*sentMessage = await ctx.telegram.sendVideo(
          channel,
          message.video.file_id,
          options,
      );*/
      return;
    } else {
      if (chat.settings.comments) {
        await ctx.createComment(parsedMessage, options);
      }

      sentMessage = await ctx.telegram.sendMessage(
        channel,
        parsedMessage,
        options,
      );


    }

    return sentMessage;
  };

  const handler = ctx => {
    if (!ctx.chat.type.includes(`group`)) return;

    const { message, text, entities, tags } = getMessage(ctx);
    db.groups.findOne({ chat_id: ctx.chat.id }, async (err, chat) => {
      if (err) return console.error(err);
      if (!chat || !chat.tags) return;

      const sentChannels = [];

      for (const tag of tags) {
        if (!chat.tags[tag]) {
          continue;
        }

        // Convert to array for backwards compatibility
        if (!Array.isArray(chat.tags[tag])) {
          chat.tags[tag] = [chat.tags[tag]];
        }

        for (const channel of chat.tags[tag]) {
          if (sentChannels.includes(channel)) {
            continue;
          }

          const sentMessage = await sendMessage(
            ctx,
            chat,
            channel,
            message,
            text,
            entities,
          );
          sentChannels.push(channel);
          repldb.set(sentMessage.message_id, ctx.from.id).then(() => { });
          db.messages.insert({
            chat_id: ctx.chat.id,
            message_id: message.message_id,
            channel_id: channel,
            channel_message_id: sentMessage.message_id,
            sendPMID: ctx.from.id,
          });
        }
      }
    });



  };

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  bot.entity(`hashtag`, commentMiddleware, handler);

  bot.on(`edited_message`, (ctx, next) => {
    if (!ctx.chat.type.includes(`group`)) return;

    const { message, text, entities } = getMessage(ctx);
    const { id: chat_id } = ctx.chat;

    db.messages.find(
      { chat_id, message_id: message.message_id },
      (err, channelMessages) => {
        if (err) return console.error(err);

        if (!channelMessages.length) {
          const entities =
            ctx.editedMessage.entities ||
            ctx.editedMessage.caption_entities ||
            [];

          if (entities.some(entity => entity.type === `hashtag`)) {
            commentMiddleware(ctx, next);
            handler(ctx);
          }

          return;
        }

        db.groups.findOne({ chat_id }, async (err, chat) => {
          if (err) return console.error(err);
          if (!chat) return;

          for (const channelMessage of channelMessages) {
            // Use `!== false` in case it's `undefined`
            if (
              !chat.settings ||
              chat.settings.forwards !== false
            ) {
              ctx.telegram.forwardMessage(
                channelMessage.channel_id,
                ctx.chat.id,
                message.message_id,
              );

              ctx.telegram
                .deleteMessage(
                  channelMessage.channel_id,
                  channelMessage.channel_message_id,
                )
                .catch(() => { });

              continue;
            }

            const parsedMessage = textToHtml(text, entities);
            const chatId = ctx.chat.id.toString().slice(4);
            const directLink = ctx.chat.username || `c/${chatId}`;

            const func =
              message.audio ||
                message.document ||
                message.photo ||
                message.video
                ? ctx.telegram.editMessageCaption
                : ctx.telegram.editMessageText;

            const [plus, minus] = await countLikes(
              chat_id,
              channelMessage.channel_message_id,
            );

            func.call(
              ctx.telegram,
              channelMessage.channel_id,
              channelMessage.channel_message_id,
              null,
              parsedMessage,
              {
                reply_markup: getReplyMarkup({
                  chat,
                  directLink,
                  message_id: message.message_id,
                  plus,
                  minus,
                }),
                parse_mode: `html`,
              },
            ).catch(async err => {
              console.log(err);

              if (
                err.description ===
                `Bad Request: message to edit not found`
              ) {
                commentMiddleware(ctx, next);

                const sentMessage = await sendMessage(
                  ctx,
                  chat,
                  channelMessage.channel_id,
                  message,
                  parsedMessage,
                  [],
                );
                console.log(ctx.from.id)
                repldb.set(sentMessage.message_id, ctx.from.id).then(() => { });
                db.messages.insert({
                  chat_id: ctx.chat.id,
                  message_id: message.message_id,
                  channel_id: channelMessage.channel_id,
                  channel_message_id: sentMessage.message_id,
                  sendPMID: ctx.from.id,
                });
              } else {
                console.log(err);
              }
            });
          }
        });
      },
    );
  });

  bot.action('callback_query_notif', async ctx => {
 /*repldb.list().then(keys => {
          keys.forEach((key) => {
            sleep(200).then(() => { repldb.delete(key).then(() =>{}) });
      });
 });
 requests.list().then(keys => {
          keys.forEach((key) => {
            sleep(200).then(() => { requests.delete(key).then(() =>{}) });
      });
 });
     //list all keys
     repldb.list().then(keys => { console.log(keys) });
    //delete all keys
    (async () => {
    await repldb.empty();
    await requests.empty();
})();*/
    var sendPM;
    //sendPMID = 12345678;
    //console.log("chat id is" +ctx.chat.id+"\nMessage id is"+ctx.message.message_id)
    //console.log(ctx.JSON.Stringify())
    console.log("channel message id is" + ctx.callbackQuery.message.message_id)
    const messageId = ctx.callbackQuery.message.message_id

    //test group = -1001293118439, test channel = -1001451172774
    //bookcrush group = -1001497963829, bookcrush channel = -1001179445761
    const chatID = -1001497963829
    const channelId = -1001179445761
    const query = { chat_id: chatID, channel_id: channelId, channel_message_id: messageId }
    /*sleep(100).then(() => { 
      db.messages.findOne(query, async (err, res) => {
      if(err)
        console.log(err)
      else {
        console.log(chatID,messageId)
        console.log("Retrieved this "+res.sendPMID)
        sendPM = res.sendPMID;
        console.log(sendPM)
      }
    }
    );
    });*/
    var originalRequest;

    sleep(100).then(() => {
      repldb.get(messageId).then(value => { sendPM = value });
    });
    sleep(300).then(() => {
      requests.get(sendPM).then(value => { originalRequest = value });
    });

    //module.exports.sendPMID = sendPMID;
    sleep(200).then(() => { console.log(sendPM + "is the id") });

    sleep(500).then(() => {

      ctx.telegram.sendMessage(sendPM, `<i>Your <a href="${originalRequest}">Request</a> has been fulfilled. Follow the link to your request and Search 🔎 to download your fulfilled book.\n\nTip: Search with "@" in the search bar to see all your tags</i>`, { parse_mode: "HTML" }).catch(err => {
        if (err.code !== 200)
          return ctx.answerCbQuery(`Tagged in Group ✅   PM Alert 🚫`);
        else
          return ctx.answerCbQuery(`Tagged in Group ✅   PM Alert ✅`);
      });
     
      
      sleep(800).then(() => {
        var first = "BookCrush Member"
        ctx.telegram.getChatMember(chatID, sendPM).then(function(chatMember) {
          console.log(chatMember.user.first_name.toString())
          first = chatMember.user.first_name.toString();
          const Extra = require('telegraf/extra')
          const Markup = require('telegraf/markup')

          const markup = Markup.inlineKeyboard([
            //bot.inlineButton('🔗 Reddit', { url: `https://www.reddit.com${redditPost.permalink}` }),
            Markup.urlButton('PM me for alerts','https://t.me/BookCrushMgrBot'),
            Markup.callbackButton('🗑 (admins only)', 'callback_delete'
            ),
            
          ]);

          //var delmessage;
          //async () => {
            delmessage = ctx.telegram.sendMessage(-1001497963829, `Hey [${first}](tg://user?id=${sendPM}) 👋, Here's your requested book. Happy Reading/Listening!`, {
            parse_mode: 'Markdown', disable_web_page_preview: true, reply_markup: markup
          })
          /*console.log(delmessage)
          }
          console.log(delmessage.message_id)
          sleep(1000).then(() => {
            ctx.telegram.deleteMessage(delmessage.message_id);
          });*/
        });
        ctx.answerCbQuery(`Tagged in Group ✅\nPM Alert ✅`);
      });

    });
  }
  )

  bot.action('callback_delete', async ctx => {
    ctx.telegram.getChatMember(-1001497963829, ctx.from.id).then(function(chatMember) { 
      if (chatMember.status == "administrator" || chatMember.status == "creator")
        ctx.deleteMessage();
      else
        ctx.answerCbQuery('You need to be an admin to do this!');
    });
  });
}; 
