import { analyzeFolders, uploadRemoteBundle } from '../src/analysis';
import { prepareFilePath } from '../src/files';
import { baseURL, sessionToken, sampleProjectPath, bundleFiles } from './constants/base';
import emitter from '../src/emitter';
import { AnalysisResponseProgress } from '../src/http';

describe('Functional test of analysis', () => {
  it('analyze folder', async () => {
    const onScanFilesProgress = jest.fn((processed: number) => {
      expect(typeof processed).toBe('number');
      expect([0, bundleFiles.length]).toContain(processed);
    });
    emitter.on(emitter.events.scanFilesProgress, onScanFilesProgress);

    const onComputeHashProgress = jest.fn((processed: number, total: number) => {
      expect(typeof processed).toBe('number');
      expect(typeof total).toBe('number');

      expect(processed).toBeLessThanOrEqual(total);
    });
    emitter.on(emitter.events.computeHashProgress, onComputeHashProgress);

    const onCreateBundleProgress = jest.fn((processed: number, total: number) => {
      expect(typeof processed).toBe('number');
      expect(total).toEqual(2);

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
    expect(bundle).toHaveProperty('analysisUrl');
    expect(Object.keys(bundle.analysisResults.files).length).toEqual(4);
    expect(Object.keys(bundle.analysisResults.suggestions).length).toEqual(8);

    // Check if emitter event happened
    expect(onScanFilesProgress).toHaveBeenCalledTimes(2);
    expect(onComputeHashProgress).toHaveBeenCalled();
    expect(onCreateBundleProgress).toHaveBeenCalledTimes(3);
    expect(onAnalyseProgress).toHaveBeenCalled();

    // Test uploadRemoteBundle with empty list of files
    let uploaded = await uploadRemoteBundle(baseURL, sessionToken, {
      bundleId: bundle.bundleId,
      missingFiles: [],
    });
    // We do nothing in such cases
    expect(uploaded).toEqual(true);

    const onUploadBundleProgress = jest.fn((processed: number, total: number) => {
      expect(typeof processed).toBe('number');
      expect(total).toEqual(bundleFiles.length);

      expect(processed).toBeLessThanOrEqual(total);
    });
    emitter.on(emitter.events.uploadBundleProgress, onUploadBundleProgress);

    // Forse uploading files one more time
    uploaded = await uploadRemoteBundle(baseURL, sessionToken, {
      bundleId: bundle.bundleId,
      missingFiles: bundleFiles.map(d => prepareFilePath(d)),
    });

    expect(uploaded).toEqual(true);

    expect(onUploadBundleProgress).toHaveBeenCalledTimes(2);
  });
});
