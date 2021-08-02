import { Schema, model } from 'mongoose';
import { Message } from '../typings/db';

const messageSchema = new Schema(
    {
        chat_id: {
            type: Number,
            required: true,
        },
        message_id: {
            type: Number,
            required: true,
        },
        channel_id: {
            type: Number,
            required: true,
        },
        channel_message_id: {
            type: Number,
            required: true,
        },
    },
    { timestamps: true },
);

messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 });

export default model<Message>('Message', messageSchema);
