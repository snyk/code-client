// Native replacement for lodash.omit: returns a shallow copy of `value` without the given keys.
export function omit<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Omit<T, K> {
  const exclude = new Set<PropertyKey>(keys);
  const result = {} as Omit<T, K>;

  for (const key of Object.keys(value) as (keyof T)[]) {
    if (!exclude.has(key)) {
      (result as T)[key] = value[key];
    }
  }

  return result;
}
