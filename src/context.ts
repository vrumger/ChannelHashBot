import { ExtraReplyMessage, InlineKeyboardButton, InlineKeyboardMarkup } from 'telegraf/typings/telegram-types';
import { Context } from 'telegraf';
import { Like as ILike } from './typings/db';
import Like from './models/like';
import { MongooseFilterQuery } from 'mongoose';
import { actionMap } from './handlers/likes';
import request from 'request-promise';

const adminStatuses = ['creator', 'administrator'];

interface CommentOptions {
    api_key: string;
    owner_id: number;
    type: 'text' | 'photo';
    text: string;
    photo_url?: string;
    caption: string;
    parse_mode: 'Markdown' | 'HTML';
    administrators: string;
    disable_notifications?: boolean;
}

export default class CustomContext extends Context {
    async isAdmin(chatId: number, fromId: number): Promise<boolean> {
        const member = await this.telegram.getChatMember(chatId, fromId);
        return adminStatuses.includes(member.status);
    }

    private _countLikes(
        query: MongooseFilterQuery<Pick<ILike, '_id' | 'chat_id' | 'from_id' | 'message_id' | 'action'>>,
    ): Promise<number> {
        return new Promise((resolve, reject) => {
            Like.countDocuments(query, (error, likes) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(likes);
                }
            });
        });
    }

    countLikes(chat_id: number, message_id: number): Promise<[number, number]> {
        return Promise.all([
            this._countLikes({ chat_id, message_id, action: '+' }),
            this._countLikes({ chat_id, message_id, action: '-' }),
        ]);
    }

    private async _uploadPhoto(photo: Buffer): Promise<string> {
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
    }

    async downloadPhoto(): Promise<Buffer | null> {
        const message = this.message || this.editedMessage;
        if (!message || !('photo' in message)) {
            return null;
        }

        const fileId = [...message.photo].pop()?.file_id;
        if (!fileId) {
            return null;
        }

        const link = await this.telegram.getFileLink(fileId);
        return await request({
            uri: link.toString(),
            encoding: null,
        });
    }

    async createComment(text: string, admins: number[], options: ExtraReplyMessage): Promise<ExtraReplyMessage> {
        const result = { ...options };

        const message = this.message || this.editedMessage;
        if (!message) {
            return result;
        }

        let comment;
        const commentOptions: CommentOptions = {
            api_key: process.env.COMMENTS_API_KEY as string,
            owner_id: 234480941,
            type: 'text',
            caption: text,
            text,
            parse_mode: 'HTML',
            administrators: admins.join(','),
        };

        try {
            if ('photo' in message) {
                const photo = await this.downloadPhoto();
                if (photo) {
                    const telegraphUrl = await this._uploadPhoto(photo);
                    commentOptions.type = 'photo';
                    commentOptions.photo_url = telegraphUrl;
                }

                comment = await request({
                    url: 'https://api.comments.bot/createPost',
                    json: true,
                    body: commentOptions,
                });
                console.log({ comment });
            }
        } catch (_) {
            // Ignore error
        }

        if (comment) {
            if (!result.reply_markup) {
                result.reply_markup = {
                    inline_keyboard: [],
                };
            }

            const replyMarkup = result.reply_markup as InlineKeyboardMarkup;
            replyMarkup.inline_keyboard.push([
                {
                    text: 'View Comments',
                    login_url: {
                        url: comment.result.link,
                        forward_text: 'View Comments',
                        bot_username: 'CommentsBot',
                    },
                },
            ]);

            result.reply_markup = replyMarkup;
        }

        return result;
    }

    formatLikeKeyboard(plus: number, minus: number): InlineKeyboardButton[] {
        return [
            {
                text: plus === 0 && minus === 0 ? actionMap['+'] : `${actionMap['+']} (${plus})`,
                callback_data: '+1',
            },
            {
                text: plus === 0 && minus === 0 ? actionMap['-'] : `${actionMap['-']} (${minus})`,
                callback_data: '-1',
            },
        ];
    }

    async handleError(error: Error): Promise<boolean> {
        if (error) {
            console.log(error);
            await this.answerCbQuery('🚫 There was an error.');
            return true;
        }

        return false;
    }
}
