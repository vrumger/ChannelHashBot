const actionMap = new Map([
    [`+`, `👍`],
    [`-`, `👎`],
]);

module.exports = (plus, minus) => {
    return [
        {
            text:
                plus === 0 && minus === 0
                    ? actionMap.get(`+`)
                    : `${actionMap.get(`+`)} (${plus})`,
            callback_data: `+1`,
        },
        {
            text:
                plus === 0 && minus === 0
                    ? actionMap.get(`-`)
                    : `${actionMap.get(`-`)} (${minus})`,
            callback_data: `-1`,
        },
    ];
};

module.exports.actionMap = actionMap;
