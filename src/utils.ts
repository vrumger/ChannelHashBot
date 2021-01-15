import { Message } from 'typegram';

type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
// eslint-disable-next-line @typescript-eslint/ban-types
type Deunionize<T extends object> = T & Partial<UnionToIntersection<T>>;

// eslint-disable-next-line @typescript-eslint/ban-types
export const deunionize = <T extends object>(t: T): Deunionize<T> => t;

export function getText(msg: Message | undefined): string | undefined {
    if (msg == null) return undefined;
    if ('caption' in msg) return msg.caption;
    if ('text' in msg) return msg.text;
    return undefined;
}

export function getEntities(msg: Message | undefined): MessageEntity[] {
    if (msg == null) return [];
    if ('caption_entities' in msg) return msg.caption_entities ?? [];
    if ('entities' in msg) return msg.entities ?? [];
    return [];
}
