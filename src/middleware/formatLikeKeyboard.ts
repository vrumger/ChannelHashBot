export const actionMap = new Map([
    [`+`, `👍`],
    [`-`, `👎`],
]);

export default (plus: number, minus: number) => {
    return [
        {
            text: plus === 0 && minus === 0 ? actionMap.get(`+`) : `${actionMap.get(`+`)} (${plus})`,
            callback_data: `+1`,
        },
        {
            text: plus === 0 && minus === 0 ? actionMap.get(`-`) : `${actionMap.get(`-`)} (${minus})`,
            callback_data: `-1`,
        },
    ];
};
