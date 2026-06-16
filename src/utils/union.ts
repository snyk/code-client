// Native replacement for lodash.union: concatenates the arrays and removes duplicates,
// preserving the order of first occurrence.
export function union<T>(...arrays: readonly (readonly T[])[]): T[] {
  return [...new Set(arrays.flat())];
}
