import { Schema, model } from 'mongoose';
import { Like } from '../typings/db';

const likeSchema = new Schema(
    {
        chat_id: {
            type: Number,
            required: true,
        },
        from_id: {
            type: Number,
            required: true,
        },
        message_id: {
            type: Number,
            required: true,
        },
        action: {
            type: String,
            enum: ['+', '-'],
        },
    },
    { timestamps: true },
);

export default model<Like>('Like', likeSchema);
