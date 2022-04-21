import path from 'path';

import { createBundleFromFolders } from '../src/bundles';
import { baseURL, sessionToken, source } from './constants/base';
import { sampleProjectPath } from './constants/sample';

describe('Functional test for bundle creation', () => {
  it('should return a bundle with correct parameters', async () => {
    const paths: string[] = [path.join(sampleProjectPath)];
    const symlinksEnabled = false;
    const defaultFileIgnores = undefined;
    const base64Encoding = false;

    const result = await createBundleFromFolders({
      baseURL,
      sessionToken,
      source,
      paths,
      symlinksEnabled,
      defaultFileIgnores,
      base64Encoding,
    });

    expect(result).not.toBeNull();
    expect(result).toHaveProperty('bundleHash');
    expect(result).toHaveProperty('missingFiles');
  });
});
