import { Document } from 'mongoose';

// Channels

export interface Channel extends Document {
    chat_id: number;
    admins: number[];
    title: string;
    username?: string;
}

// Groups

export interface Group extends Document {
    chat_id: number;
    tags?: GroupTags;
    settings?: GroupSettings;
}

export interface GroupTags {
    [key: string]: number[];
}

export interface GroupSettings {
    likes?: boolean;
    forwards?: boolean;
    link?: boolean;
    comments?: boolean;
}

// Messages

export interface Message extends Document {
    chat_id: number;
    message_id: number;
    channel_id: number;
    channel_message_id: number;
}

// Likes

export interface Like extends Document {
    chat_id: number;
    from_id: number;
    message_id: number;
    action: '+' | '-';
}
