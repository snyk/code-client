// eslint-disable-next-line import/prefer-default-export, @typescript-eslint/no-explicit-any
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
