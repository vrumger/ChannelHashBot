import request from 'request-promise';
import { TContext, TNext } from '../typings';
import { InlineKeyboardMarkup } from 'telegraf/typings/telegram-types';

const uploadPhoto = async (photo: any) => {
    const uploadedPhoto = await request.post({
        method: `POST`,
        uri: `https://telegra.ph/upload`,
        json: true,
        formData: {
            file: {
                value: Buffer.from(photo, `base64`),
                options: {
                    filename: `image.jpg`,
                    contentType: `image/jpeg`,
                },
            },
        },
    });

    return `https://telegra.ph${uploadedPhoto[0].src}`;
};

export default (ctx: TContext, next: TNext) => {
    ctx.downloadPhoto = async function () {
        const message = (this.message || this.editedMessage)!;
        const photos = [...message.photo!];
        const photo = photos.pop()!.file_id;
        const link = await this.telegram.getFileLink(photo);

        return await request({
            uri: link,
            encoding: null,
        });
    };

    ctx.createComment = async function (text: string, options) {
        const message = (this.message || this.editedMessage)!;

        let comment;
        const commentOptions: { [k: string]: any } = {
            api_key: process.env.COMMENTS_API_KEY as string,
            owner_id: 234480941,
            type: `text`,
            caption: text,
            text: text,
            parse_mode: `html`,
        };

        try {
            if (message.photo) {
                const photo = await this.downloadPhoto!();
                const telegraphUrl = await uploadPhoto(photo);

                commentOptions.type = `photo`;
                commentOptions.photo_url = telegraphUrl;
            }

            comment = await request({
                url: `https://api.comments.bot/createPost`,
                json: true,
                body: commentOptions,
            });
        } catch (_) {
            // Ignore errors
        }

        if (comment) {
            if (!options.reply_markup) {
                options.reply_markup = { inline_keyboard: [] };
            }

            // TODO:
            // @ts-ignore
            options.reply_markup.inline_keyboard.push([
                {
                    text: `View Comments`,
                    // @ts-ignore telegram-typings is outdated
                    login_url: {
                        url: comment.result.link,
                        forward_text: `View Comments`,
                        bot_username: `CommentsBot`,
                    },
                },
            ]);
        }
    };

    next();
};
