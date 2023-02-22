import path from 'path';

import * as needle from '../src/needle';
import { createBundleFromFolders } from '../src/bundles';
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

  it('sends analysis metadata for bundle request', async () => {
    const makeRequestSpy = jest.spyOn(needle, 'makeRequest');

    try {
      await createBundleFromFolders({
        baseURL,
        sessionToken,
        source,
        org: 'org',
        extraHeaders: { 'x-custom-header': 'custom-value' },
        paths: [sampleProjectPath],
        symlinksEnabled: false,
      });
    } catch (err) {
      // Authentication mechanism should deny the request as this user does not belong to the org 'org'
      expect(err).toEqual({
        apiName: 'createBundle',
        statusCode: 401,
        statusText: 'Missing, revoked or inactive token',
      });
    }

    const makeRequestSpyLastCalledWith = makeRequestSpy.mock.calls[makeRequestSpy.mock.calls.length - 1][0];
    expect(makeRequestSpyLastCalledWith).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          'snyk-org-name': 'org',
          source: 'test-source',
          'x-custom-header': 'custom-value',
        }),
      }),
    );
  });
});
