import 'jest-extended';

import { collectIgnoreRules, parseFileIgnores } from '../src/files';
import { sampleProjectPath, fileIgnoresFixtures, bundleFileIgnores } from './constants/sample';

describe('file ignores', () => {
  describe('sample-repo', () => {
    it('parses dc ignore file', () => {
      const patterns = parseFileIgnores(`${sampleProjectPath}/.dcignore`);
      expect(patterns).toEqual(bundleFileIgnores.slice(1, 10));
    });

    it('parses dot snyk file', () => {
      const patterns = parseFileIgnores(`${sampleProjectPath}/.snyk`);
      expect(patterns).toEqual(bundleFileIgnores.slice(10));
    });

    it('parses dot snyk file with only one field', () => {
      const patterns = parseFileIgnores(`${sampleProjectPath}/exclude/.snyk`);
      expect(patterns).toEqual(bundleFileIgnores.slice(12));
    });

    it('fails to parse dot snyk file with invalid field', () => {
      expect(() => parseFileIgnores(`${sampleProjectPath}/invalid-dot-snyk/.snyk.invalid`)).toThrow(
        'Please make sure ignore file follows correct syntax',
      );
    });

    it('collects ignore rules', async () => {
      const ignoreRules = await collectIgnoreRules([sampleProjectPath]);
      expect(ignoreRules).toEqual(bundleFileIgnores);
    });
  });

  describe('collects correct ignore rules', () => {
    it('from dot snyk files', async () => {
      const collectPath = `${fileIgnoresFixtures}/dot-snyk-excludes/sub`;
      const ignoreRules = await collectIgnoreRules([collectPath]);
      expect(ignoreRules).toMatchInlineSnapshot(`
        Array [
          "**/.git/**",
          "${collectPath}/root-excluded/**",
          "${collectPath}/root-excluded",
          "${collectPath}/**/deep-excluded/**",
          "${collectPath}/**/deep-excluded",
        ]
      `);
    });

    it('from dot snyk files (with deduplication)', async () => {
      const collectPath = `${fileIgnoresFixtures}/dot-snyk-excludes`;
      const ignoreRules = await collectIgnoreRules([collectPath]);
      expect(ignoreRules).toMatchInlineSnapshot(`
        Array [
          "**/.git/**",
          "${collectPath}/root-excluded/**",
          "${collectPath}/root-excluded",
          "${collectPath}/root-excluded-contents/**",
          "${collectPath}/**/deep-excluded/**",
          "${collectPath}/**/deep-excluded",
          "${collectPath}/**/deep-excluded-contents/**",
          "${collectPath}/sub/root-excluded/**",
          "${collectPath}/sub/root-excluded",
        ]
      `);
    });

    it('from dot dcignore file', async () => {
      const collectPath = `${fileIgnoresFixtures}/dot-dcignore-rules`;
      const ignoreRules = await collectIgnoreRules([collectPath]);
      expect(ignoreRules).toMatchInlineSnapshot(`
        Array [
          "**/.git/**",
          "${collectPath}/root-excluded/**",
          "${collectPath}/root-excluded",
          "${collectPath}/root-excluded-contents/**",
          "${collectPath}/**/deep-excluded/**",
          "${collectPath}/**/deep-excluded",
          "${collectPath}/**/deep-excluded-contents/**",
          "!${collectPath}/not/deep-excluded/**",
          "!${collectPath}/not/deep-excluded",
        ]
      `);
    });

    it('from dot gitignore file', async () => {
      const collectPath = `${fileIgnoresFixtures}/dot-gitignore-rules`;
      const ignoreRules = await collectIgnoreRules([collectPath]);
      expect(ignoreRules).toMatchInlineSnapshot(`
        Array [
          "**/.git/**",
          "${collectPath}/root-excluded/**",
          "${collectPath}/root-excluded",
          "${collectPath}/root-excluded-contents/**",
          "${collectPath}/**/deep-excluded/**",
          "${collectPath}/**/deep-excluded",
          "${collectPath}/**/deep-excluded-contents/**",
          "!${collectPath}/not/deep-excluded/**",
          "!${collectPath}/not/deep-excluded",
        ]
      `);
    });
  });
});
