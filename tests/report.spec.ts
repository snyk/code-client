import path from 'path';
import { baseURL, sessionToken, source } from './constants/base';
import { reportBundle } from '../src/report';
import * as http from '../src/http';
import { sampleProjectPath, initReportReturn, getReportReturn } from './constants/sample';

const mockInitReport = jest.spyOn(http, 'initReport');
mockInitReport.mockReturnValue(Promise.resolve({ type: 'success', value: initReportReturn }));
jest.spyOn(http, 'getReport').mockReturnValue(Promise.resolve({ type: 'success', value: getReportReturn }));

describe('Functional test for report', () => {
  const paths: string[] = [path.join(sampleProjectPath)];

  const baseConfig = {
    baseURL,
    sessionToken,
    source,
    paths,
  };

  it('should complete report with correct parameters', async () => {
    const reportConfig = {
      enabled: true,
      projectName: 'test-project',
      targetName: 'test-target',
      targetRef: 'test-ref',
      remoteRepoUrl: 'https://github.com/owner/repo',
    };

    const result = await reportBundle({
      bundleHash: 'dummy-bundle',
      ...baseConfig,
      report: reportConfig,
    });

    expect(mockInitReport).toHaveBeenCalledWith(
      expect.objectContaining({
        report: reportConfig,
      }),
    );

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

    expect(async () => {
      await reportBundle({
        bundleHash: 'dummy-bundle',
        ...baseConfig,
        report: reportConfig,
      });
    }).rejects.toThrowError('"project-name" must be provided for "report"');
  });
});
