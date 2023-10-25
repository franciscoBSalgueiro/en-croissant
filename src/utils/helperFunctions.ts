
export function* takeWhile<T>(collection: Iterable<T>, condition: (item: T) => boolean): Generator<T> {
    for (let item of collection) {
        if (condition(item)) yield item;
        else break;
    }
}

export function* skipWhile<T>(collection: Iterable<T>, condition: (item: T) => boolean): Generator<T> {
    let conditionBroken = false;
    for (let item of collection) {
        if (!conditionBroken && !condition(item)) {
            conditionBroken = true;
        }
        if (conditionBroken) {
            yield item;
        }
    }
}