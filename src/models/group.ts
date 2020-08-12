import { Schema, model } from 'mongoose';
import { Group } from '../typings/db';

const groupSchema = new Schema(
    {
        chat_id: {
            type: Number,
            required: true,
        },
        tags: {
            type: Schema.Types.Mixed,
        },
        settings: {
            type: Schema.Types.Mixed,
        },
    },
    { timestamps: true },
);

export default model<Group>('Group', groupSchema);
