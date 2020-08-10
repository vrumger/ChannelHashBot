import { TContext, TNext } from '../typings';
import { InlineKeyboardMarkup } from 'telegraf/typings/telegram-types';
import request from 'request-promise';

const uploadPhoto = async (photo: Buffer) => {
    const uploadedPhoto = await request.post({
        method: 'POST',
        uri: 'https://telegra.ph/upload',
        json: true,
        formData: {
            file: {
                value: photo,
                options: {
                    filename: 'image.jpg',
                    contentType: 'image/jpeg',
                },
            },
        },
    });

    return `https://telegra.ph${uploadedPhoto[0].src}`;
};

export default (ctx: TContext, next: TNext): void => {
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
        const commentOptions: { [k: string]: string | number } = {
            api_key: process.env.COMMENTS_API_KEY as string,
            owner_id: 234480941,
            type: 'text',
            caption: text,
            text: text,
            parse_mode: 'html',
        };

        try {
            if (message.photo) {
                const photo = await this.downloadPhoto!();
                const telegraphUrl = await uploadPhoto(photo);

                commentOptions.type = 'photo';
                commentOptions.photo_url = telegraphUrl;
            }

            comment = await request({
                url: 'https://api.comments.bot/createPost',
                json: true,
                body: commentOptions,
            });
        } catch (_) {
            // Ignore error
        }

        if (comment) {
            if (!options.reply_markup) {
                options.reply_markup = { inline_keyboard: [] };
            }

            // TODO:
            (options.reply_markup as InlineKeyboardMarkup).inline_keyboard.push(
                [
                    {
                        text: 'View Comments',
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-ignore telegram-typings is outdated
                        login_url: {
                            url: comment.result.link,
                            forward_text: 'View Comments',
                            bot_username: 'CommentsBot',
                        },
                    },
                ],
            );
        }
    };

    next();
};
