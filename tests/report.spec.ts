import path from 'path';
import { createBundleFromFolders } from '../src/bundles';
import { baseURL, sessionToken, source } from './constants/base';
import { reportBundle } from '../src/report';
import * as http from '../src/http';
import { sampleProjectPath, initReportReturn, getReportReturn } from './constants/sample';

jest.spyOn(http, 'initReport').mockReturnValue(Promise.resolve({ type: 'success', value: initReportReturn }));
jest.spyOn(http, 'getReport').mockReturnValue(Promise.resolve({ type: 'success', value: getReportReturn }));

describe('Functional test for report', () => {
  const paths: string[] = [path.join(sampleProjectPath)];

  const baseConfig = {
    baseURL,
    sessionToken,
    source,
    paths,
  };

  it('should report a bundle with correct parameters', async () => {
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

    expect(result).not.toBeNull();
    expect(result.status).toBe('COMPLETE');
    expect(result).toHaveProperty('uploadResult');
    expect(result).toHaveProperty('analysisResult');
  });

  it('should fail report if no project name was given', async () => {
    const reportConfig = {
      enabled: true,
      projectName: undefined,
    };

    const bundleResult = await createBundleFromFolders(baseConfig);

    expect(bundleResult).not.toBeNull();
    expect(bundleResult).toHaveProperty('bundleHash');
    const bundleHash = bundleResult?.bundleHash;
    if (!bundleHash) return;

    expect(async () => {
      await reportBundle({
        bundleHash,
        ...baseConfig,
        report: reportConfig,
      });
    }).rejects.toThrowError('"project-name" must be provided for "report"');
  });
});
