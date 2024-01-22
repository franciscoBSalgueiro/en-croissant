export function* takeWhile<T>(
  collection: Iterable<T>,
  condition: (item: T) => boolean,
): Generator<T> {
  for (const item of collection) {
    if (condition(item)) yield item;
    else break;
  }
}

export function* skipWhile<T>(
  collection: Iterable<T>,
  condition: (item: T) => boolean,
): Generator<T> {
  let conditionBroken = false;
  for (const item of collection) {
    if (!conditionBroken && !condition(item)) {
      conditionBroken = true;
    }
    if (conditionBroken) {
      yield item;
    }
  }
}

export function arrayEquals<T>(a: T[], b: T[]): boolean {
  if (a == b) return true;
  if (a == undefined || b == undefined) return false;
  if (a.length != b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (a[i] != b[i]) return false;
  }
  return true;
}
