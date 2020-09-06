
import { ServiceAI } from '../src/index';
import { defaultBaseURL as baseURL } from '../src/constants/common';
import { sessionToken, bundleId, expiredBundleId } from './mocks/base-config';

import startMockServer from './mocks/mock-server';
import {
  createBundleRequest,
  extendBundleRequest,
  extendBundleRequestExpired,
  uploadFilesRequest,
  reportTelemetryRequest,
  mockProjectPath,
  mockFiles,
  mockNewAnalysisResults,
} from './mocks/requests';
import {
  startSessionResponse,
  getFiltersResponse,
  createBundleResponse,
  checkBundleResponse,
  extendBundleResponse,
  getAnalysisResponse,
  checkBundleError404,
  extendBundleError404,
} from './mocks/responses';

import { IQueueAnalysisCheckResult } from '../src/interfaces/queue.interface';

startMockServer();

async function sleep(timeout: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => resolve(), timeout);
  });
}

describe('Requests to public API', () => {
  const AI = new ServiceAI();

  /**
   * Report error
   */
  it('reports error successfully', async () => {
    const response = await AI.http.reportError(reportTelemetryRequest);
    expect(response.type).toEqual('success');
  });

  /**
   * Report event
   */
  it('reports event successfully', async () => {
    const response = await AI.http.reportEvent(reportTelemetryRequest);
    expect(response.type).toEqual('success');
  });

  /**
   * Start Session
   */
  it('starts session successfully', async () => {
    const options = {
      source: 'atom',
      baseURL,
    };

    const response = await AI.http.startSession(options);
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value).toEqual(startSessionResponse);
  });

  /**
   * Check Session
   */
  it('checks session successfully', async () => {
    const options = {
      baseURL,
      sessionToken,
    };

    const response = await AI.http.checkSession(options);
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value).toEqual(true);
  });

  /**
   * Get filters
   */
  it('gets filters successfully', async () => {
    const options = {
      baseURL,
      sessionToken,
    };

    const response = await AI.http.getFilters(options);
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value).toEqual(getFiltersResponse);
  });

  /**
   * Create Bundle
   */
  it('creates bundle successfully', async () => {
    const response = await AI.http.createBundle(createBundleRequest);
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value).toEqual(createBundleResponse);
  });

  /**
   * Check Bundle
   */
  it('checks bundle successfully', async () => {
    const options = {
      baseURL,
      sessionToken,
      bundleId,
    };

    const response = await AI.http.checkBundle(options);
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value).toEqual(checkBundleResponse);
  });

  it('checks expired bundle successfully', async () => {
    const options = {
      baseURL,
      sessionToken,
      bundleId: expiredBundleId,
    };

    const response = await AI.http.checkBundle(options);
    expect(response.type).toEqual('error');
    // dummy to cheat typescript compiler
    if (response.type == 'success') return;
    expect(response.error.statusCode).toEqual(checkBundleError404.statusCode);
    expect(response.error.statusText).toEqual(checkBundleError404.statusText);
  });

  /**
   * Extend Bundle
   */
  it('extends bundle successfully', async () => {
    const response = await AI.http.extendBundle(extendBundleRequest);
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value).toEqual(extendBundleResponse);
  });

  it('extends expired bundle successfully', async () => {
    const response = await AI.http.extendBundle(extendBundleRequestExpired);

    expect(response.type).toEqual('error');
    // dummy to cheat typescript compiler
    if (response.type == 'success') return;
    expect(response.error.statusCode).toEqual(extendBundleError404.statusCode);
    expect(response.error.statusText).toEqual(extendBundleError404.statusText);
  });

  /**
   * Upload Files
   */
  it('uploads files successfully', async () => {
    const response = await AI.http.uploadFiles(uploadFilesRequest);
    expect(response.type).toEqual('success');
  });

  /**
   * Get Analysis
   */
  it('gets analysis successfully', async () => {
    const options = {
      baseURL,
      sessionToken,
      bundleId,
    };

    const response = await AI.http.getAnalysis(options);
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value).toEqual(getAnalysisResponse);
  });

  /**
   * Get Analysis Result
   */
  it('gets analysis result', async () => {
    const options = {
      baseURL,
      sessionToken,
      baseDir: mockProjectPath,
      files: mockFiles,
      removedFiles: [],
    };

    AI.on(
      'analyseFinish',
      async (result: IQueueAnalysisCheckResult): Promise<void> => {
        expect(result).toEqual(mockNewAnalysisResults);
      },
    );

    await AI.analyse(options);
    await sleep(500);
  });
});
