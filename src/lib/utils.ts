// We are using the same types that Object.fromEntries has
// eslint-disable-next-line import/prefer-default-export, @typescript-eslint/no-explicit-any
export function fromEntries(entries: Iterable<readonly any[]>): any;
export function fromEntries<T = any>(
  entries: Iterable<readonly [PropertyKey, T]>,
): {
  [k in PropertyKey]: T;
} {
  return [...entries].reduce((obj, [key, val]) => {
    obj[key] = val; // eslint-disable-line no-param-reassign
    return obj;
  }, {});
}
