import 'jest-extended';

import { collectFilePolicies, parseFileIgnores } from '../src/files';
import { sampleProjectPath, fileIgnoresFixtures, bundleFileIgnores, bundleFilePolicies } from './constants/sample';

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
      const ignoreRules = await collectFilePolicies([sampleProjectPath]);
      expect(ignoreRules).toEqual(bundleFilePolicies);
    });
  });

  describe('collects correct ignore rules', () => {
    it('from dot snyk files', async () => {
      const collectPath = `${fileIgnoresFixtures}/dot-snyk-excludes`;
      const ignoreRules = await collectFilePolicies([collectPath]);
      expect(ignoreRules).toMatchInlineSnapshot(`
        {
          "excludes": [
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-snyk-excludes/root-excluded/**",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-snyk-excludes/root-excluded",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-snyk-excludes/root-excluded-contents/**",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-snyk-excludes/**/deep-excluded/**",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-snyk-excludes/**/deep-excluded",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-snyk-excludes/**/deep-excluded-contents/**",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-snyk-excludes/sub/root-excluded/**",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-snyk-excludes/sub/root-excluded",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-snyk-excludes/sub/**/deep-excluded/**",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-snyk-excludes/sub/**/deep-excluded",
          ],
          "ignores": [
            "**/.git/**",
          ],
        }
      `);
    });

    it('from dot dcignore file', async () => {
      const collectPath = `${fileIgnoresFixtures}/dot-dcignore-rules`;
      const ignoreRules = await collectFilePolicies([collectPath]);
      expect(ignoreRules).toMatchInlineSnapshot(`
        {
          "excludes": [],
          "ignores": [
            "**/.git/**",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-dcignore-rules/root-excluded/**",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-dcignore-rules/root-excluded",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-dcignore-rules/root-excluded-contents/**",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-dcignore-rules/**/deep-excluded/**",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-dcignore-rules/**/deep-excluded",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-dcignore-rules/**/deep-excluded-contents/**",
            "!/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-dcignore-rules/not/deep-excluded/**",
            "!/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-dcignore-rules/not/deep-excluded",
          ],
        }
      `);
    });

    it('from dot gitignore file', async () => {
      const collectPath = `${fileIgnoresFixtures}/dot-gitignore-rules`;
      const ignoreRules = await collectFilePolicies([collectPath]);
      expect(ignoreRules).toMatchInlineSnapshot(`
        {
          "excludes": [],
          "ignores": [
            "**/.git/**",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-gitignore-rules/root-excluded/**",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-gitignore-rules/root-excluded",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-gitignore-rules/root-excluded-contents/**",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-gitignore-rules/**/deep-excluded/**",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-gitignore-rules/**/deep-excluded",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-gitignore-rules/**/deep-excluded-contents/**",
            "!/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-gitignore-rules/not/deep-excluded/**",
            "!/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/dot-gitignore-rules/not/deep-excluded",
          ],
        }
      `);
    });

    it('from combined files', async () => {
      const collectPath = `${fileIgnoresFixtures}/combined`;
      const ignoreRules = await collectFilePolicies([collectPath]);
      expect(ignoreRules).toMatchInlineSnapshot(`
        {
          "excludes": [
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/combined/snyk-root-excluded/**",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/combined/snyk-root-excluded",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/combined/**/snyk-deep-excluded/**",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/combined/**/snyk-deep-excluded",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/combined/sub/snyk-nested-excluded/**",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/combined/sub/snyk-nested-excluded",
          ],
          "ignores": [
            "**/.git/**",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/combined/dcignore-root-excluded/**",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/combined/dcignore-root-excluded",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/combined/**/dcignore-deep-excluded/**",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/combined/**/dcignore-deep-excluded",
            "!/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/combined/dcignore-root-not-excluded/**",
            "!/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/combined/dcignore-root-not-excluded",
            "!/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/combined/**/dcignore-deep-not-excluded/**",
            "!/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/combined/**/dcignore-deep-not-excluded",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/combined/gitignore-root-excluded/**",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/combined/gitignore-root-excluded",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/combined/**/gitignore-deep-excluded/**",
            "/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/combined/**/gitignore-deep-excluded",
            "!/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/combined/gitignore-root-not-excluded/**",
            "!/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/combined/gitignore-root-not-excluded",
            "!/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/combined/**/gitignore-deep-not-excluded/**",
            "!/Users/fsargent/src/snyk/code-client/tests/fixtures/file-ignores/combined/**/gitignore-deep-not-excluded",
          ],
        }
      `);
    });
  });
});
