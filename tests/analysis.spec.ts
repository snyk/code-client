
import path from 'path';
import jsonschema from 'jsonschema';

import { analyzeFolders } from '../src/analysis';
import { uploadRemoteBundle } from '../src/bundles';
import { baseURL, sessionToken, source, TEST_TIMEOUT } from './constants/base';
import { sampleProjectPath, bundleFiles, bundleFilesFull } from './constants/sample';
import emitter from '../src/emitter';
import { AnalysisResponseProgress } from '../src/http';
import { SupportedFiles } from '../src/interfaces/files.interface';
import { AnalysisSeverity } from '../src/interfaces/analysis-options.interface';
import * as sarifSchema from './sarif-schema-2.1.0.json';

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
          expect(total).toEqual(1);

          expect(processed).toBeLessThanOrEqual(total);
        });
        emitter.on(emitter.events.createBundleProgress, onCreateBundleProgress);

        const onAnalyseProgress = jest.fn((data: AnalysisResponseProgress) => {
          expect(['WAITING', 'FETCHING', 'ANALYZING', 'DC_DONE']).toContain(data.status);
          expect(typeof data.progress).toBe('number');
          expect(data.progress).toBeGreaterThanOrEqual(0);
          expect(data.progress).toBeLessThanOrEqual(100);
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
          },
          fileOptions: {
            paths: [sampleProjectPath],
            symlinksEnabled: false,
            maxPayload: 1000,
          },
        });

        expect(bundle).toBeTruthy();
        if (!bundle) return; // TS trick

        // TODO: follow sarif format
        // expect(Object.keys(bundle.analysisResults.files).length).toEqual(5);
        // expect(
        //   bundle.analysisResults.files.hasOwnProperty(`${sampleProjectPath}/GitHubAccessTokenScrambler12.java`),
        // ).toBeTruthy();
        // expect(Object.keys(bundle.analysisResults.suggestions).length).toEqual(8);

        expect(bundle.analysisResults.timing.analysis).toBeGreaterThanOrEqual(
          bundle.analysisResults.timing.fetchingCode,
        );
        expect(bundle.analysisResults.timing.queue).toBeGreaterThanOrEqual(0);
        expect(new Set(bundle.analysisResults.coverage)).toEqual(
          new Set([
            {
              files: 2,
              isSupported: true,
              lang: 'Java',
            },
            {
              files: 1,
              isSupported: true,
              lang: 'C++ (beta)',
            },
            {
              files: 4,
              isSupported: true,
              lang: 'JavaScript',
            },
            {
              files: 1,
              isSupported: true,
              lang: 'JSX',
            },
          ]),
        );

        // Check if emitter event happened
        expect(onSupportedFilesLoaded).toHaveBeenCalledTimes(2);
        expect(onScanFilesProgress).toHaveBeenCalledTimes(9);
        expect(onCreateBundleProgress).toHaveBeenCalledTimes(2);
        expect(onAnalyseProgress).toHaveBeenCalled();
        expect(onAPIRequestLog).toHaveBeenCalled();

        // Test uploadRemoteBundle with empty list of files
        let uploaded = await uploadRemoteBundle({
          baseURL, sessionToken, source,
          bundleHash: bundle.fileBundle.bundleHash,
          files: []
        });
        // We do nothing in such cases
        expect(uploaded).toEqual(true);

        const onUploadBundleProgress = jest.fn((processed: number, total: number) => {
          expect(typeof processed).toBe('number');
          expect(total).toEqual(bFiles.length);

          expect(processed).toBeLessThanOrEqual(total);
        });
        emitter.on(emitter.events.uploadBundleProgress, onUploadBundleProgress);

        // Forse uploading files one more time
        uploaded = await uploadRemoteBundle({
          baseURL, sessionToken, source,
          bundleHash: bundle.fileBundle.bundleHash,
          files: bFiles
        });

        expect(uploaded).toEqual(true);

        expect(onUploadBundleProgress).toHaveBeenCalledTimes(2);
        expect(onAPIRequestLog).toHaveBeenCalled();
      },
      TEST_TIMEOUT,
    );

    it('analyze folder - with sarif returned', async () => {
      const bundle = await analyzeFolders({
        connection: { baseURL, sessionToken, source },
        analysisOptions: { severity: AnalysisSeverity.info },
        fileOptions: {
          paths: [sampleProjectPath],
          symlinksEnabled: false,
          maxPayload: 1000,
          defaultFileIgnores: undefined,
        },
      });

      expect(bundle).toBeTruthy();
      if (!bundle) return; // TS trick

      const validationResult = jsonschema.validate(bundle.analysisResults.sarif, sarifSchema);

      console.log('validationResult.errors --> ', validationResult.errors);
      expect(validationResult.errors.length).toEqual(0);
    });

    it('analyze empty folder', async () => {
      const bundle = await analyzeFolders({
        connection: { baseURL, sessionToken, source },
        analysisOptions: { severity: AnalysisSeverity.info },
        fileOptions: {
          paths: [path.join(sampleProjectPath, 'only_text')],
          symlinksEnabled: false,
          maxPayload: 1000,
          defaultFileIgnores: undefined,
        },
      });

      expect(bundle).toBeNull();
    });
  });

});
