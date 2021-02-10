import path from 'path';
import jsonschema from 'jsonschema';

import { analyzeFolders } from '../src/analysis';
import { uploadRemoteBundle } from '../src/bundles';
import { baseURL, sessionToken, TEST_TIMEOUT } from './constants/base';
import { sampleProjectPath, bundleFiles, bundleFilesFull } from './constants/sample';
import emitter from '../src/emitter';
import { AnalysisResponseProgress } from '../src/http';
import { ISupportedFiles } from '../src/interfaces/files.interface';
import { AnalysisSeverity } from '../src/interfaces/analysis-result.interface';
import * as sarifSchema from './sarif-schema-2.1.0.json';

describe('Functional test of analysis', () => {
  it(
    'analyze folder',
    async () => {
      const onSupportedFilesLoaded = jest.fn((data: ISupportedFiles | null) => {
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
        expect(total).toEqual(3);

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

      const bundle = await analyzeFolders(baseURL, sessionToken, false, 1, [sampleProjectPath], false, 1000);
      expect(bundle).toHaveProperty('baseURL');
      expect(bundle).toHaveProperty('sessionToken');
      expect(bundle).toHaveProperty('supportedFiles');
      expect(bundle).toHaveProperty('analysisURL');
      expect(Object.keys(bundle.analysisResults.files).length).toEqual(4);
      expect(bundle.analysisResults.files.hasOwnProperty(`${sampleProjectPath}/AnnotatorTest.cpp`)).toBeTruthy();
      expect(Object.keys(bundle.analysisResults.suggestions).length).toEqual(8);

      expect(bundle.analysisResults.timing.analysis).toBeGreaterThanOrEqual(bundle.analysisResults.timing.fetchingCode);
      expect(bundle.analysisResults.timing.queue).toBeGreaterThanOrEqual(0);
      expect(new Set(bundle.analysisResults.coverage)).toEqual(
        new Set([
          {
            files: 1,
            isSupported: true,
            lang: 'C++ (beta)',
          },
          {
            files: 1,
            isSupported: false,
            lang: 'JSON',
          },
          {
            files: 1,
            isSupported: true,
            lang: 'Java',
          },
          {
            files: 4,
            isSupported: true,
            lang: 'JavaScript',
          },
        ]),
      );

      // Check if emitter event happened
      expect(onSupportedFilesLoaded).toHaveBeenCalledTimes(2);
      expect(onScanFilesProgress).toHaveBeenCalledTimes(8);
      expect(onCreateBundleProgress).toHaveBeenCalledTimes(4);
      expect(onAnalyseProgress).toHaveBeenCalled();

      // Test uploadRemoteBundle with empty list of files
      let uploaded = await uploadRemoteBundle(baseURL, sessionToken, bundle.bundleId, []);
      // We do nothing in such cases
      expect(uploaded).toEqual(true);

      const onUploadBundleProgress = jest.fn((processed: number, total: number) => {
        expect(typeof processed).toBe('number');
        expect(total).toEqual(bFiles.length);

        expect(processed).toBeLessThanOrEqual(total);
      });
      emitter.on(emitter.events.uploadBundleProgress, onUploadBundleProgress);

      // Forse uploading files one more time
      uploaded = await uploadRemoteBundle(baseURL, sessionToken, bundle.bundleId, bFiles);

      expect(uploaded).toEqual(true);

      expect(onUploadBundleProgress).toHaveBeenCalledTimes(2);
    },
    TEST_TIMEOUT,
  );

  it('analyze folder - with sarif returned', async () => {
    const includeLint = false;
    const severityLevel = AnalysisSeverity.info;
    const paths: string[] = [path.join(sampleProjectPath, 'only_text')];
    const symlinksEnabled = false;
    const maxPayload = 1000;
    const defaultFileIgnores = undefined;
    const sarif = true;

    const bundle = await analyzeFolders(
      baseURL,
      sessionToken,
      includeLint,
      severityLevel,
      paths,
      symlinksEnabled,
      maxPayload,
      defaultFileIgnores,
      sarif,
    );
    const validationResult = jsonschema.validate(bundle.sarifResults, sarifSchema);

    expect(validationResult.errors.length).toEqual(0);
  });

  it('analyze empty folder', async () => {
    const includeLint = false;
    const severityLevel = AnalysisSeverity.info;
    const paths: string[] = [path.join(sampleProjectPath, 'only_text')];
    const symlinksEnabled = false;
    const maxPayload = 1000;

    const bundle = await analyzeFolders(
      baseURL,
      sessionToken,
      includeLint,
      severityLevel,
      paths,
      symlinksEnabled,
      maxPayload,
    );

    expect(bundle.analysisResults.files).toEqual({});
    expect(bundle.analysisResults.suggestions).toEqual({});
    expect(bundle.analysisResults.coverage).toEqual([]);
  });
});
