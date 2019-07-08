const request = require(`request-promise`);

const uploadPhoto = async photo => {
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

module.exports = (ctx, next) => {
    ctx.downloadPhoto = async function() {
        const photos = [...this.message.photo];
        const photo = photos.pop().file_id;
        const link = await ctx.telegram.getFileLink(photo);

        return await request({
            uri: link,
            encoding: null,
        });
    };

    ctx.createComment = async (text, options) => {
        let comment;
        const commentOptions = {
            api_key: process.env.COMMENTS_API_KEY,
            owner_id: 234480941,
            type: `text`,
            caption: text,
            text: text,
            parse_mode: `html`,
        };

        try {
            if (ctx.photo) {
                const photo = await ctx.downloadPhoto();
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

            options.reply_markup.inline_keyboard.push([
                {
                    text: `View Comments`,
                    login_url: {
                        url: comment.result.link,
                        forward_text: `View Comments`,
                        bot_username: `CommentsBot`,
                    },
                },
            ]);
        }
    };

    next(ctx);
};
