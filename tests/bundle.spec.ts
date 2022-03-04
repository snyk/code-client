import path from 'path';

import { createBundleFromFolders } from '../src/bundles';
import { baseURL, sessionToken, source } from './constants/base';
import { sampleProjectPath, supportedFiles } from './constants/sample';
import nock from 'nock';

describe('Functional test for bundle creation', () => {
  nock(baseURL).get('/filters').reply(200, supportedFiles);
  nock(baseURL).post('/bundle').reply(200, { success: true, missingFiles: [], bundleHash: 'bundleHash' });
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
});
