import { baseURL, sessionToken, source } from './constants/base';
import { reportBundle, reportScm } from '../src/report';
import * as http from '../src/http';
import * as needle from '../src/needle';
import { initReportReturn, getReportReturn } from './constants/sample';

const mockInitReport = jest.spyOn(http, 'initReport');
const mockGetReport = jest.spyOn(http, 'getReport');
const mockInitScmReport = jest.spyOn(http, 'initScmReport');
const mockGetScmReport = jest.spyOn(http, 'getScmReport');

describe('Functional test for report', () => {
  const baseConfig = {
    baseURL,
    sessionToken,
    source,
  };

  describe('reportBundle - File-based (bundle) report', () => {
    beforeAll(() => {
      mockInitReport.mockResolvedValue({ type: 'success', value: initReportReturn });
      mockGetReport.mockResolvedValue({ type: 'success', value: getReportReturn });
    });

    afterAll(() => {
      mockInitReport.mockRestore();
      mockGetReport.mockRestore();
    });

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
        .mockResolvedValueOnce({ success: false, errorCode: statusCode, error: new Error(expectedErrorMessage) });

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

  describe('reportScm - SCM-based (Git) report', () => {
    beforeAll(() => {
      mockInitScmReport.mockResolvedValue({ type: 'success', value: initReportReturn });
      mockGetScmReport.mockResolvedValue({ type: 'success', value: getReportReturn });
    });

    afterAll(() => {
      mockInitScmReport.mockRestore();
      mockGetScmReport.mockRestore();
    });

    it('should complete report with correct parameters', async () => {
      const reportConfig = {
        projectId: '00000000-0000-0000-0000-000000000000',
        commitId: '0000000',
      };

      const result = await reportScm({
        ...baseConfig,
        ...reportConfig,
      });

      expect(mockInitScmReport).toHaveBeenCalledWith(expect.objectContaining(reportConfig));

      expect(result).not.toBeNull();
      expect(result.status).toBe('COMPLETE');
      expect(result).toHaveProperty('uploadResult');
      expect(result).toHaveProperty('analysisResult');
    });

    it('should fail report if no project ID was given', async () => {
      await expect(
        reportScm({
          ...baseConfig,
        }),
      ).rejects.toHaveProperty('message', '"project-id" must be provided for "report"');
    });

    it('should fail report if the given project ID is not a valid UUID', async () => {
      await expect(
        reportScm({
          ...baseConfig,
          projectId: 'invalid-id',
        }),
      ).rejects.toHaveProperty('message', `"project-id" must be a valid UUID`);
    });

    it('should fail report if no commit ID was given', async () => {
      const reportConfig = {
        projectId: '00000000-0000-0000-0000-000000000000',
      };

      await expect(
        reportScm({
          ...baseConfig,
          ...reportConfig,
        }),
      ).rejects.toHaveProperty('message', '"commit-id" must be provided for "report"');
    });

    it('getScmReport should return error with received error message rather than generic error message', async () => {
      const statusCode = 400;
      const expectedErrorMessage = 'Dummy received error message';

      mockGetScmReport.mockRestore();
      jest
        .spyOn(needle, 'makeRequest')
        .mockResolvedValueOnce({ success: false, errorCode: statusCode, error: new Error(expectedErrorMessage) });

      const reportConfig = {
        projectId: '00000000-0000-0000-0000-000000000000',
        commitId: '0000000',
      };

      await expect(
        reportScm({
          ...baseConfig,
          ...reportConfig,
        }),
      ).rejects.toMatchObject({
        apiName: 'getReport',
        statusCode: statusCode,
        statusText: expectedErrorMessage,
      });
    });
  });
});
