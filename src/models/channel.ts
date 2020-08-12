import { Schema, model } from 'mongoose';
import { Channel } from '../typings/db';

const channelSchema = new Schema(
    {
        chat_id: {
            type: Number,
            required: true,
        },
        admins: [{ type: Number }],
        title: {
            type: String,
            required: true,
        },
        username: { type: String },
    },
    { timestamps: true },
);

export default model<Channel>('Channel', channelSchema);
