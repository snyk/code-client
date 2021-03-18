import path from 'path';
import write from 'write';
import fs from 'fs';
import { Cache, readJSON } from '../src/cache';
describe('Cache', () => {
  afterAll(() => {
    const dir = path.resolve(__dirname, '../fixtures');
    fs.rmdir(dir, { recursive: true }, err => {
      if (err) {
        throw err;
      }
    });
  });
  it('should not crash if the cache file exists but it is an empty string', function () {
    const cachePath = path.resolve(__dirname, '../fixtures/.cache2');
    write.sync(path.join(cachePath, 'someId'), '');

    expect(function () {
      const cache = new Cache('someId', cachePath);
      expect(cache.persisted).toEqual({});
    }).not.toThrow(Error);
  });

  it('should not crash if the cache file exists but it is an invalid JSON string', function () {
    const cachePath = path.resolve(__dirname, '../fixtures/.cache2');
    write.sync(path.join(cachePath, 'someId'), '{ "foo": "fookey", "bar" ');

    expect(function () {
      const cache = new Cache('someId', cachePath);
      expect(cache.persisted).toEqual({});
    }).not.toThrow(Error);
  });

  describe('loading an existing cache custom directory', function () {
    beforeEach(function () {
      const cache = new Cache('someId', path.resolve(__dirname, '../fixtures/.cache2'));
      cache.setKey('foo', {
        bar: 'baz',
      });
      cache.setKey('bar', {
        foo: 'baz',
      });
      cache.save();
    });

    it('should load an existing cache', function () {
      const cache = new Cache('someId', path.resolve(__dirname, '../fixtures/.cache2'));
      expect(readJSON(path.resolve(__dirname, '../fixtures/.cache2/someId'))).toEqual(cache.persisted);
    });

    it('should return the same structure if load called twice with the same docId', function () {
      const cache = new Cache('someId', path.resolve(__dirname, '../fixtures/.cache2'));
      const cache2 = new Cache('someId', path.resolve(__dirname, '../fixtures/.cache2'));

      expect(cache.persisted).toEqual(cache2.persisted);
    });
  });
});
