// The generic needs `object` here to preserve current call-site inference without widening to unsafe types.
// eslint-disable-next-line @typescript-eslint/ban-types
export function pick<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;

  for (const key of keys) {
    if (Object.hasOwn(value, key)) {
      result[key] = value[key];
    }
  }

  return result;
}
