import path from 'path';
import nock from 'nock';
import jsonschema from 'jsonschema';
import 'jest-extended';

import { analyzeFolders, extendAnalysis, analyzeBundle, analyzeScmProject } from '../src/analysis';
import { uploadRemoteBundle } from '../src/bundles';
import { baseURL, sessionToken, source, TEST_TIMEOUT } from './constants/base';
import { sampleProjectPath, bundleFilesFull, bundleExtender, getReportReturn } from './constants/sample';
import { emitter } from '../src/emitter';
import { AnalysisResponseProgress } from '../src/http';
import { SupportedFiles } from '../src/interfaces/files.interface';
import { AnalysisSeverity, AnalysisContext } from '../src/interfaces/analysis-options.interface';
import * as sarifSchema from './sarif-schema-2.1.0.json';
import * as needle from '../src/needle';
import * as report from '../src/report';

describe('Functional test of analysis', () => {
  describe('analyzeFolders', () => {
    it(
      'analyze folder',
      async () => {
        const onSupportedFilesLoaded = jest.fn((data: SupportedFiles | null) => {
          if (data === null) {
            // all good
          }
        });
        emitter.on(emitter.events.supportedFilesLoaded, onSupportedFilesLoaded);

        const bFiles = await bundleFilesFull;
        const onScanFilesProgress = jest.fn((processed: number) => {
          expect(typeof processed).toBe('number');
          expect(processed).toBeGreaterThanOrEqual(0);
          expect(processed).toBeLessThanOrEqual(bFiles.length);
        });
        emitter.on(emitter.events.scanFilesProgress, onScanFilesProgress);

        const onCreateBundleProgress = jest.fn((processed: number, total: number) => {
          expect(typeof processed).toBe('number');
          expect(processed).toBeLessThanOrEqual(total);
        });
        emitter.on(emitter.events.createBundleProgress, onCreateBundleProgress);

        const onAnalyseProgress = jest.fn((data: AnalysisResponseProgress) => {
          expect(['WAITING', 'FETCHING', 'ANALYZING', 'DC_DONE']).toContain(data.status);
          expect(typeof data.progress).toBe('number');
          expect(data.progress).toBeGreaterThanOrEqual(0);
          expect(data.progress).toBeLessThanOrEqual(1);
        });
        emitter.on(emitter.events.analyseProgress, onAnalyseProgress);

        const onAPIRequestLog = jest.fn((message: string) => {
          expect(typeof message).toBe('string');
        });
        emitter.on(emitter.events.apiRequestLog, onAPIRequestLog);

        const bundle = await analyzeFolders({
          connection: { baseURL, sessionToken, source },
          analysisOptions: {
            severity: 1,
            prioritized: true,
          },
          fileOptions: {
            paths: [sampleProjectPath],
            symlinksEnabled: false,
          },
        });

        expect(bundle).toBeTruthy();
        if (!bundle) return; // TS trick

        expect(bundle.analysisResults.type === 'sarif').toBeTruthy();
        if (bundle.analysisResults.type !== 'sarif') return;

        expect(bundle.analysisResults.sarif.runs[0].tool.driver.rules?.length).toBeGreaterThan(0);
        expect(bundle.analysisResults.sarif.runs[0].results?.length).toBeGreaterThan(0);
        const sampleRes = bundle.analysisResults.sarif.runs[0].results!.find(
          res => res.locations?.[0].physicalLocation?.artifactLocation?.uri === `GitHubAccessTokenScrambler12.java`,
        );
        expect(sampleRes).toBeTruthy();
        if (!sampleRes) return; // TS trick
        expect(sampleRes.ruleIndex).toBeDefined();
        if (!sampleRes.ruleIndex) return; // TS trick
        expect(sampleRes.ruleId).toEqual(
          bundle.analysisResults.sarif.runs[0].tool.driver.rules![sampleRes.ruleIndex].id,
        );

        expect(bundle.analysisResults.timing.analysis).toBeGreaterThanOrEqual(0);
        expect(bundle.analysisResults.timing.fetchingCode).toBeGreaterThanOrEqual(0);
        expect(bundle.analysisResults.timing.queue).toBeGreaterThanOrEqual(0);
        expect(bundle.analysisResults.coverage).toIncludeSameMembers([
          {
            files: 2,
            isSupported: true,
            lang: 'Java',
            type: 'SUPPORTED',
          },
          {
            files: 1,
            isSupported: true,
            lang: 'C++',
            type: 'SUPPORTED',
          },
          {
            files: 6,
            isSupported: true,
            lang: 'JavaScript',
            type: 'SUPPORTED',
          },
        ]);

        // Check if emitter event happened
        expect(onSupportedFilesLoaded).toHaveBeenCalledTimes(2);
        expect(onScanFilesProgress).toHaveBeenCalledTimes(bFiles.length);
        expect(onCreateBundleProgress).toHaveBeenCalledTimes(2);
        expect(onAnalyseProgress).toHaveBeenCalled();
        expect(onAPIRequestLog).toHaveBeenCalled();

        // Test uploadRemoteBundle with empty list of files
        await uploadRemoteBundle({
          baseURL,
          sessionToken,
          source,
          bundleHash: bundle.fileBundle.bundleHash,
          files: [],
        });

        const onUploadBundleProgress = jest.fn((processed: number, total: number) => {
          expect(typeof processed).toBe('number');
          expect(processed).toBeLessThanOrEqual(total);
        });
        emitter.on(emitter.events.uploadBundleProgress, onUploadBundleProgress);

        const shouldNotBeInBundle = [
          '/.eslintrc.json', // <= no linters on backend
          'big-file.js', // <= over MAX_FILE_SIZE
        ];
        // Force uploading files one more time
        await uploadRemoteBundle({
          baseURL,
          sessionToken,
          source,
          bundleHash: bundle.fileBundle.bundleHash,
          files: bFiles.filter(({ bundlePath }) => !shouldNotBeInBundle.includes(bundlePath)),
        });
        expect(onUploadBundleProgress).toHaveBeenCalledTimes(2);
        expect(onAPIRequestLog).toHaveBeenCalled();
      },
      TEST_TIMEOUT,
    );

    it('analyze folder legacy json results', async () => {
      const bundle = await analyzeFolders({
        connection: { baseURL, sessionToken, source },
        analysisOptions: { severity: AnalysisSeverity.info, prioritized: true, legacy: true },
        fileOptions: {
          paths: [sampleProjectPath],
          symlinksEnabled: false,
          defaultFileIgnores: undefined,
        },
      });

      expect(bundle).toBeTruthy();
      if (!bundle) return; // TS trick

      expect(bundle.analysisResults.type === 'legacy').toBeTruthy();
      if (bundle.analysisResults.type !== 'legacy') return;

      expect(Object.keys(bundle.analysisResults.files).length).toBeGreaterThan(0);
      expect(Object.keys(bundle.analysisResults.suggestions).length).toBeGreaterThan(0);
    });

    it('analyze folder - with sarif returned', async () => {
      const bundle = await analyzeFolders({
        connection: { baseURL, sessionToken, source },
        analysisOptions: { severity: AnalysisSeverity.info, prioritized: true },
        fileOptions: {
          paths: [sampleProjectPath],
          symlinksEnabled: false,
          defaultFileIgnores: undefined,
        },
      });

      expect(bundle).toBeTruthy();
      if (!bundle) return; // TS trick

      expect(bundle.analysisResults.type === 'sarif').toBeTruthy();
      if (bundle.analysisResults.type !== 'sarif') return;

      const validationResult = jsonschema.validate(bundle.analysisResults.sarif, sarifSchema);
      expect(validationResult.errors.length).toEqual(0);
    });

    it('analyze empty folder', async () => {
      const bundle = await analyzeFolders({
        connection: { baseURL, sessionToken, source },
        analysisOptions: { severity: AnalysisSeverity.info },
        fileOptions: {
          paths: [path.join(sampleProjectPath, 'only_text')],
          symlinksEnabled: false,
          defaultFileIgnores: undefined,
        },
      });

      expect(bundle).toBeNull();
    });

    it(
      'extend folder analysis',
      async () => {
        const fileAnalysis = await analyzeFolders({
          connection: { baseURL, sessionToken, source },
          analysisOptions: {
            severity: 1,
          },
          fileOptions: {
            paths: [sampleProjectPath],
            symlinksEnabled: false,
          },
        });

        expect(fileAnalysis).toBeTruthy();
        if (!fileAnalysis) return; // TS trick

        expect(fileAnalysis.analysisResults.type === 'sarif').toBeTruthy();
        if (fileAnalysis.analysisResults.type !== 'sarif') return;

        expect(fileAnalysis.analysisResults.sarif.runs[0].tool.driver.rules?.length).toBeGreaterThan(0);
        expect(fileAnalysis.analysisResults.sarif.runs[0].results?.length).toBeGreaterThan(0);

        const extender = await bundleExtender();
        type Awaited<T> = T extends PromiseLike<infer U> ? Awaited<U> : T;
        let extendedBundle!: Awaited<ReturnType<typeof extendAnalysis>>;
        try {
          extender.exec();
          extendedBundle = await extendAnalysis({
            ...fileAnalysis,
            files: extender.files.all,
          });
        } catch (err) {
          console.error(err);
          expect(err).toBeFalsy();
        } finally {
          extender.restore();
        }
        expect(extendedBundle).toBeTruthy();
        if (!extendedBundle) return; // TS trick

        expect(extendedBundle.analysisResults.type === 'sarif').toBeTruthy();
        if (extendedBundle.analysisResults.type !== 'sarif') return;

        const sarifResults = extendedBundle.analysisResults.sarif;

        expect(sarifResults.runs[0].tool.driver.rules?.length).toBeGreaterThan(0);
        expect(sarifResults.runs[0].results?.length).toBeGreaterThan(0);
        const getRes = (path: string) =>
          sarifResults.runs[0].results!.find(
            res => res.locations?.[0].physicalLocation?.artifactLocation?.uri === path,
          );
        const sampleRes = getRes(extender.files.added);
        const changedRes = getRes(extender.files.changed);
        const removedRes = getRes(extender.files.removed);
        expect(changedRes).toBeUndefined();
        expect(removedRes).toBeUndefined();
        expect(sampleRes).toBeTruthy();
        if (!sampleRes) return; // TS trick
        expect(sampleRes.ruleIndex).toBeDefined();
        if (!sampleRes.ruleIndex) return; // TS trick
        expect(sampleRes.ruleId).toEqual(sarifResults.runs[0].tool.driver.rules![sampleRes.ruleIndex].id);

        expect(extendedBundle.analysisResults.timing.analysis).toBeGreaterThanOrEqual(0);
        expect(extendedBundle.analysisResults.timing.fetchingCode).toBeGreaterThanOrEqual(0);
        expect(extendedBundle.analysisResults.timing.queue).toBeGreaterThanOrEqual(0);
        expect(extendedBundle.analysisResults.coverage).toIncludeSameMembers([
          {
            files: 2,
            isSupported: true,
            lang: 'Java',
            type: 'SUPPORTED',
          },
          {
            files: 1,
            isSupported: true,
            lang: 'C++',
            type: 'SUPPORTED',
          },
          {
            files: 4,
            isSupported: true,
            lang: 'JavaScript',
            type: 'SUPPORTED',
          },
          {
            files: 1,
            isSupported: true,
            lang: 'JSX',
            type: 'SUPPORTED',
          },
        ]);
      },
      TEST_TIMEOUT,
    );

    it('sends analysis metadata for analysis request', async () => {
      const analysisContext: AnalysisContext = {
        analysisContext: {
          flow: 'test',
          initiator: 'CLI',
          org: {
            name: 'org',
            displayName: 'organization',
            publicId: 'id',
            flags: {},
          },
          project: {
            name: 'proj',
            publicId: 'id',
            type: 'code',
          },
        },
      };

      const makeRequestSpy = jest.spyOn(needle, 'makeRequest');

      try {
        await analyzeBundle({
          baseURL,
          sessionToken,
          source,
          org: 'org',
          severity: 1,
          bundleHash: 'hash',
          shard: sampleProjectPath,
          ...analysisContext,
        });
      } catch (err) {
        // Authentication mechanism should deny the request as this user does not belong to the org 'org'
        expect(err).toEqual({
          apiName: 'getAnalysis',
          statusCode: 401,
          statusText: 'Missing, revoked or inactive token',
        });
      }

      const makeRequestSpyLastCalledWith = makeRequestSpy.mock.calls[makeRequestSpy.mock.calls.length - 1][0];
      expect(makeRequestSpyLastCalledWith).toEqual(
        expect.objectContaining({
          body: expect.objectContaining(analysisContext),
          headers: expect.objectContaining({
            'snyk-org-name': 'org',
            source: 'test-source',
          }),
        }),
      );
    });

    it('should successfully analyze folder and report results with the report option enabled', async () => {
      nock(baseURL, { allowUnmocked: true })
        .post('/report')
        .reply(200, { reportId: 'report-id' })
        .get('/report/report-id')
        .reply(200, getReportReturn);

      const result = await analyzeFolders({
        connection: { baseURL, sessionToken, source },
        analysisOptions: { severity: AnalysisSeverity.info },
        fileOptions: {
          paths: [sampleProjectPath],
          symlinksEnabled: false,
        },
        reportOptions: {
          enabled: true,
          projectName: 'test-project',
        },
      });

      nock.cleanAll();

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('fileBundle');
      expect(result).toHaveProperty('analysisResults');
      expect(result).toHaveProperty('reportResults');
    });

    it('should successfully analyze folder but not report with the report option disabled', async () => {
      const mockReportBundle = jest.spyOn(report, 'reportBundle');

      const bundle = await analyzeFolders({
        connection: { baseURL, sessionToken, source },
        analysisOptions: { severity: AnalysisSeverity.info },
        fileOptions: {
          paths: [sampleProjectPath],
          symlinksEnabled: false,
        },
      });

      expect(mockReportBundle).not.toHaveBeenCalled();
      expect(bundle).toBeTruthy();
    });
  });

  describe('analyzeScmProject', () => {
    it('should successfully analyze SCM project and report results', async () => {
      nock(baseURL, { allowUnmocked: true })
        .post('/test')
        .reply(200, { testId: 'test-id' })
        .get('/test/test-id')
        .reply(200, getReportReturn);

      const result = await analyzeScmProject({
        connection: { baseURL, sessionToken, source },
        analysisOptions: { severity: AnalysisSeverity.info },
        reportOptions: {
          projectId: '00000000-0000-0000-0000-000000000000',
          commitId: '0000000',
        },
      });

      nock.cleanAll();

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('analysisResults');
      expect(result).toHaveProperty('reportResults');
    });
  });
});
