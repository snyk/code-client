import { fromEntries } from '../src/lib/utils';
describe('fromEntries', () => {
  it('Object transformations', async () => {
    // Arrange
    const obj = { a: 1, b: 2, c: 3 };
    const expected = { a: 2, b: 4, c: 6 };

    // Action
    const fromEntriesRes = fromEntries(Object.entries(obj).map(([key, val]) => [key, val * 2]));

    // Assert
    expect(fromEntriesRes).toMatchObject(expected);
  });

  it('Converting an Array to an Object', async () => {
    // Arrange
    const arr = [
      ['0', 'a'],
      ['1', 'b'],
      ['2', 'c'],
    ];
    const expected = { 0: 'a', 1: 'b', 2: 'c' };

    // Action
    const fromEntriesRes = fromEntries(arr);

    // Assert
    expect(fromEntriesRes).toMatchObject(expected);
  });

  it('Converting a Map to an Object', async () => {
    // Arrange
    const map = new Map([
      ['foo', 12],
      ['baz', 42],
    ]);
    const expected = { foo: 12, baz: 42 };

    // Action
    const fromEntriesRes = fromEntries(map);

    // Assert
    expect(fromEntriesRes).toMatchObject(expected);
  });

  it('Duplicate key', async () => {
    // Arrange
    const arr = [
      ['foo', 1],
      ['foo', 2],
    ];
    const expected = { foo: 2 };

    // Action
    const fromEntriesRes = fromEntries(arr);

    // Assert
    expect(fromEntriesRes).toMatchObject(expected);
  });
});
