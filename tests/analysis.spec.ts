import * as nodePath from 'path';
import { analyzeFolders, uploadRemoteBundle } from '../src/analysis';
import { getFileInfo } from '../src/files';
import { baseURL, sessionToken, sampleProjectPath, bundleFilePaths } from './constants/base';
import emitter from '../src/emitter';
import { AnalysisResponseProgress } from '../src/http';

const bundleFiles = bundleFilePaths.map(f => getFileInfo(nodePath.join(sampleProjectPath, f), sampleProjectPath));

describe('Functional test of analysis', () => {
  it('analyze folder', async () => {
    const onScanFilesProgress = jest.fn((processed: number) => {
      expect(typeof processed).toBe('number');
      expect(processed).toBeGreaterThanOrEqual(0);
      expect(processed).toBeLessThanOrEqual(bundleFiles.length);;
    });
    emitter.on(emitter.events.scanFilesProgress, onScanFilesProgress);

    const onCreateBundleProgress = jest.fn((processed: number, total: number) => {
      expect(typeof processed).toBe('number');
      expect(total).toEqual(3);

      expect(processed).toBeLessThanOrEqual(total);
    });
    emitter.on(emitter.events.createBundleProgress, onCreateBundleProgress);

    const onAnalyseProgress = jest.fn((data: AnalysisResponseProgress) => {
      expect(['FETCHING', 'ANALYZING', 'DC_DONE']).toContain(data.status);
      expect(typeof data.progress).toBe('number');
      expect(data.progress).toBeGreaterThanOrEqual(0);
      expect(data.progress).toBeLessThanOrEqual(100);
    });
    emitter.on(emitter.events.analyseProgress, onAnalyseProgress);

    const bundle = await analyzeFolders(baseURL, sessionToken, false, 1, [sampleProjectPath], 1000);
    expect(bundle).toHaveProperty('baseURL');
    expect(bundle).toHaveProperty('sessionToken');
    expect(bundle).toHaveProperty('supportedFiles');
    expect(bundle).toHaveProperty('analysisURL');
    expect(Object.keys(bundle.analysisResults.files).length).toEqual(4);
    expect(Object.keys(bundle.analysisResults.suggestions).length).toEqual(8);

    // Check if emitter event happened
    expect(onScanFilesProgress).toHaveBeenCalledTimes(8);
    expect(onCreateBundleProgress).toHaveBeenCalledTimes(4);
    expect(onAnalyseProgress).toHaveBeenCalled();

    // Test uploadRemoteBundle with empty list of files
    let uploaded = await uploadRemoteBundle(baseURL, sessionToken, bundle.bundleId, []);
    // We do nothing in such cases
    expect(uploaded).toEqual(true);

    const onUploadBundleProgress = jest.fn((processed: number, total: number) => {
      expect(typeof processed).toBe('number');
      expect(total).toEqual(bundleFiles.length);

      expect(processed).toBeLessThanOrEqual(total);
    });
    emitter.on(emitter.events.uploadBundleProgress, onUploadBundleProgress);

    // Forse uploading files one more time
    uploaded = await uploadRemoteBundle(baseURL, sessionToken, bundle.bundleId, bundleFiles);

    expect(uploaded).toEqual(true);

    expect(onUploadBundleProgress).toHaveBeenCalledTimes(2);
  });
});
