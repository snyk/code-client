import path from 'path';

import { createBundleFromFolders, convertLanguagesToExtensions } from '../src/bundles';
import { baseURL, sessionToken, source } from './constants/base';
import { sampleProjectPath } from './constants/sample';

describe('Functional test for bundle creation', () => {
  it('should return a bundle with correct parameters', async () => {
    const paths: string[] = [path.join(sampleProjectPath)];
    const symlinksEnabled = false;
    const defaultFileIgnores = undefined;

    const result = await createBundleFromFolders({
      baseURL,
      sessionToken,
      source,
      paths,
      symlinksEnabled,
      defaultFileIgnores,
    });

    expect(result).not.toBeNull();
    expect(result).toHaveProperty('bundleHash');
    expect(result).toHaveProperty('missingFiles');
  });

  it('should return list of supported files based on customers settings', async () => {
    const paths: string[] = [path.join(sampleProjectPath)];
    const symlinksEnabled = false;
    const defaultFileIgnores = undefined;

    const result = await createBundleFromFolders({
      baseURL,
      sessionToken,
      source,
      paths,
      symlinksEnabled,
      defaultFileIgnores,
      customerLanguages: ['javascript'],
    });

    expect(result && result.supportedFiles.extensions).toEqual(['.js', '.es6', '.jsx']);
  });

  it('Converts code language name to file extensions, extensions as provided by deepcode backend', async () => {
    const extensions = convertLanguagesToExtensions([
      'javascript',
      'java',
      'python',
      'csharp',
      'php',
      'ruby',
      'go',
      'cpp',
      'c',
      'swift',
    ]);

    const jsExt = ['.js', '.es6', '.jsx'];
    const javaExt = ['.java'];
    const pythonExt = ['.py'];
    const cSharpExt = ['.cs'];
    const phpExt = ['.php'];
    const rubyExt = ['.rb'];
    const goExt = ['.go'];
    const cppExt = ['.cc', '.cpp', '.cxx', '.hpp'];
    const cExt = ['.c', '.h'];
    const swiftExt = ['.swift'];

    expect(extensions).toEqual(
      expect.arrayContaining([
        ...jsExt,
        ...javaExt,
        ...pythonExt,
        ...cSharpExt,
        ...phpExt,
        ...rubyExt,
        ...goExt,
        ...cExt,
        ...cppExt,
        ...cSharpExt,
        ...swiftExt,
      ]),
    );
  });
});
