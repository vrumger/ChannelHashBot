// Channels

export interface Channel {
    chat_id: number;
    admins: number[];
    title: string;
    username?: string;
}

// Chats

export interface Chat {
    chat_id: number;
    tags?: ChatTags;
    settings?: ChatSettings;
}

export interface ChatTags {
    [key: string]: number[];
}

export interface ChatSettings {
    likes?: boolean;
    forwards?: boolean;
    link?: boolean;
    comments?: boolean;
}

// Messages

export interface Message {
    chat_id: number;
    message_id: number;
    channel_id: number;
    channel_message_id: number;
}

// Likes

export interface Like {
    chat_id: number;
    from_id: number;
    message_id: number;
    action: '+' | '-';
}
