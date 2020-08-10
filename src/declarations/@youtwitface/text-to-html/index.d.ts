type MessageEntity = import('telegraf/typings/telegram-types').MessageEntity;

declare module '@youtwitface/text-to-html' {
    const textToHtml: (text: string, entities: MessageEntity[]) => string;
    export default textToHtml;
}
