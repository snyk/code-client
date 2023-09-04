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

    it('from combined files', async () => {
      const collectPath = `${fileIgnoresFixtures}/combined`;
      const ignoreRules = await collectIgnoreRules([collectPath]);
      expect(ignoreRules).toMatchInlineSnapshot(`
        Array [
          "**/.git/**",
          "${collectPath}/dcignore-root-excluded/**",
          "${collectPath}/dcignore-root-excluded",
          "${collectPath}/**/dcignore-deep-excluded/**",
          "${collectPath}/**/dcignore-deep-excluded",
          "!${collectPath}/dcignore-root-not-excluded/**",
          "!${collectPath}/dcignore-root-not-excluded",
          "!${collectPath}/**/dcignore-deep-not-excluded/**",
          "!${collectPath}/**/dcignore-deep-not-excluded",
          "${collectPath}/gitignore-root-excluded/**",
          "${collectPath}/gitignore-root-excluded",
          "${collectPath}/**/gitignore-deep-excluded/**",
          "${collectPath}/**/gitignore-deep-excluded",
          "!${collectPath}/gitignore-root-not-excluded/**",
          "!${collectPath}/gitignore-root-not-excluded",
          "!${collectPath}/**/gitignore-deep-not-excluded/**",
          "!${collectPath}/**/gitignore-deep-not-excluded",
          "${collectPath}/snyk-root-excluded/**",
          "${collectPath}/snyk-root-excluded",
          "${collectPath}/**/snyk-deep-excluded/**",
          "${collectPath}/**/snyk-deep-excluded",
          "${collectPath}/sub/snyk-nested-excluded/**",
          "${collectPath}/sub/snyk-nested-excluded",
        ]
      `);
    });

    it('from combined files, overriding negative matches', async () => {
      const collectPath = `${fileIgnoresFixtures}/negative-overrides`;
      const ignoreRules = await collectIgnoreRules([collectPath]);
      expect(ignoreRules).toMatchInlineSnapshot(`
        Array [
          "**/.git/**",
          "`);
    });

    it('from combined files, overriding negative matches [BROKEN]', async () => {
      const collectPath = `${fileIgnoresFixtures}/negative-overrides-broken`;
      const ignoreRules = await collectIgnoreRules([collectPath]);
      expect(ignoreRules).toMatchInlineSnapshot(`
        Array [
          "**/.git/**",
          "!${fileIgnoresFixtures}/negative-overrides-broken/**/sub/**",
          "${fileIgnoresFixtures}/negative-overrides-broken/**/sub/**/exclude.txt/**",
          "${fileIgnoresFixtures}/negative-overrides-broken/**/sub/**/exclude.txt",
        ]
      `);
    });
  });
});
