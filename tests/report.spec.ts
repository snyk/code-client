import path from 'path';
import { baseURL, sessionToken, source } from './constants/base';
import { reportBundle } from '../src/report';
import * as http from '../src/http';
import * as needle from '../src/needle';
import { sampleProjectPath, initReportReturn, getReportReturn } from './constants/sample';

const mockInitReport = jest.spyOn(http, 'initReport');
mockInitReport.mockReturnValue(Promise.resolve({ type: 'success', value: initReportReturn }));
const mockGetReport = jest.spyOn(http, 'getReport');
mockGetReport.mockReturnValue(Promise.resolve({ type: 'success', value: getReportReturn }));

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

    await expect(
      reportBundle({
        bundleHash: 'dummy-bundle',
        ...baseConfig,
        report: reportConfig,
      }),
    ).rejects.toHaveProperty('message', '"project-name" must be provided for "report"');
  });

  it('should fail report if the given project name exceeds the maximum length', async () => {
    const longProjectName = 'a'.repeat(65);
    const reportConfig = {
      enabled: true,
      projectName: longProjectName,
    };

    await expect(
      reportBundle({
        bundleHash: 'dummy-bundle',
        ...baseConfig,
        report: reportConfig,
      }),
    ).rejects.toHaveProperty('message', `"project-name" must not exceed 64 characters`);
  });

  it('should fail report if the given project name includes invalid characters', async () => {
    const invalidProjectName = '*&^%$';
    const reportConfig = {
      enabled: true,
      projectName: invalidProjectName,
    };

    await expect(
      reportBundle({
        bundleHash: 'dummy-bundle',
        ...baseConfig,
        report: reportConfig,
      }),
    ).rejects.toHaveProperty('message', `"project-name" must not contain spaces or special characters except [/-_]`);
  });

  it('getReport should return error with received error message rather than generic error message', async () => {
    const statusCode = 400;
    const expectedErrorMessage = 'Dummy received error message';

    mockGetReport.mockRestore();
    jest
      .spyOn(needle, 'makeRequest')
      .mockReturnValue(
        Promise.resolve({ success: false, errorCode: statusCode, error: new Error(expectedErrorMessage) }),
      );

    const reportConfig = {
      enabled: true,
      projectName: 'test-project',
      targetName: 'test-target',
      targetRef: 'test-ref',
      remoteRepoUrl: 'https://github.com/owner/repo',
    };

    await expect(
      reportBundle({
        bundleHash: 'dummy-bundle',
        ...baseConfig,
        report: reportConfig,
      }),
    ).rejects.toMatchObject({
      apiName: 'getReport',
      statusCode: statusCode,
      statusText: expectedErrorMessage,
    });
  });
});
