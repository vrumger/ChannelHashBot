import { InlineKeyboardButton } from 'telegraf/typings/markup';

export const actionMap = {
    '+': '👍',
    '-': '👎',
};

export default (plus: number, minus: number): InlineKeyboardButton[] => {
    return [
        {
            text:
                plus === 0 && minus === 0
                    ? actionMap['+']
                    : `${actionMap['+']} (${plus})`,
            callback_data: '+1',
            hide: false,
        },
        {
            text:
                plus === 0 && minus === 0
                    ? actionMap['-']
                    : `${actionMap['-']} (${minus})`,
            callback_data: '-1',
            hide: false,
        },
    ];
};
