type MessageEntity = import('typegram').MessageEntity;

declare module '@youtwitface/text-to-html' {
    const textToHtml: (text: string, entities: MessageEntity[]) => string;
    export default textToHtml;
}
