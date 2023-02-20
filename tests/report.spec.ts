import path from 'path';

import { createBundleFromFolders } from '../src/bundles';
import { baseURL, sessionToken, source } from './constants/base';
import { reportBundle } from '../src/report';
import { sampleProjectPath } from './constants/sample';

describe('Functional test for report creation', () => {
  // TODO: this test is being skipped for now since the /report flow hasn't been fully rolled out and it can't succeed for now
  it.skip('should report a bundle with correct parameters', async () => {
    const paths: string[] = [path.join(sampleProjectPath)];

    const baseConfig = {
      baseURL,
      sessionToken,
      source,
      paths,
    };

    const reportConfig = {
      enabled: true,
      projectName: 'test-project',
    };

    const bundleResult = await createBundleFromFolders(baseConfig);

    expect(bundleResult).not.toBeNull();
    expect(bundleResult).toHaveProperty('bundleHash');
    const bundleHash = bundleResult?.bundleHash;
    if (!bundleHash) return;

    const result = await reportBundle({
      bundleHash,
      ...baseConfig,
      report: reportConfig,
    });

    // TODO: check result
    console.log(result);
  });

  // TODO: error handling test(s)
});
