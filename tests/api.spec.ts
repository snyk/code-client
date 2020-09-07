
import { ServiceAI } from '../src/index';
import { defaultBaseURL as baseURL } from '../src/constants/common';
import { sessionToken, bundleId } from './mocks/base-config';

import {
  createBundleRequest,
  extendBundleRequest,
  extendBundleRequestExpired,
  uploadFilesRequest,
  reportTelemetryRequest,
} from './mocks/requests';
import {
  createBundleResponse,
  checkBundleResponse,
  extendBundleResponse,
  getAnalysisResponse,
  checkBundleError404,
  extendBundleError404,
} from './mocks/responses';
import { supportedFiles } from '../src/utils/filesUtils';

describe('Requests to public API', () => {
  const AI = new ServiceAI();
  const api = AI.http;

  /**
   * Report error
   */
  it('reports error successfully', async () => {
    const response = await api.reportError(reportTelemetryRequest);
    expect(response.type).toEqual('success');
  });

  /**
   * Report event
   */
  it('reports event successfully', async () => {
    const response = await api.reportEvent(reportTelemetryRequest);
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
    const startSessionResponse = await api.startSession(options);
    expect(startSessionResponse.type).toEqual('success');
    if (startSessionResponse.type === 'error') return;

    expect(startSessionResponse.value.loginURL).toMatch(/https:\/\/www.deepcode.ai\/login-api\?sessionToken=.*&source=atom/);
    const draftToken = startSessionResponse.value.sessionToken;

    // This token is just a draft and not ready to be used permanently
    const checkSessionResponse = await api.checkSession({ baseURL, sessionToken: draftToken });
    expect(checkSessionResponse.type).toEqual('success');
    if (checkSessionResponse.type === 'error') return;
    expect(checkSessionResponse.value).toEqual(false);
  });

  /**
   * Check Session
   */
  it('checks session unsuccessfully', async () => {
    const options = {
      baseURL,
      sessionToken: 'dummy-token',
    };

    const response = await api.checkSession(options);
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value).toEqual(false);
  });

  /**
   * Check Session
   */
  it('checks session successfully', async () => {
    const options = {
      baseURL,
      sessionToken,
    };

    const response = await api.checkSession(options);
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

    const response = await api.getFilters(options);
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value).toEqual(supportedFiles);
  });

  /**
   * Create Bundle
   */
  it('creates bundle successfully', async () => {
    const response = await api.createBundle(createBundleRequest);
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value.bundleId).toEqual(createBundleResponse.bundleId);
    expect(response.value.uploadURL).toEqual(createBundleResponse.uploadURL);
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

    const response = await api.checkBundle(options);
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value.bundleId).toEqual(checkBundleResponse.bundleId);
    expect(response.value.uploadURL).toEqual(checkBundleResponse.uploadURL);
  });

  it('checks expired bundle successfully', async () => {
    const options = {
      baseURL,
      sessionToken,
      bundleId: 'mock-expired-bundle-id',
    };

    const response = await api.checkBundle(options);
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
    const response = await api.extendBundle(extendBundleRequest);
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value.bundleId).toEqual(extendBundleResponse.bundleId);
    expect(response.value.uploadURL).toEqual(extendBundleResponse.uploadURL);
  });

  it('extends expired bundle successfully', async () => {
    const response = await api.extendBundle(extendBundleRequestExpired);

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
    const response = await api.uploadFiles(uploadFilesRequest);
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

    const response = await api.getAnalysis(options);
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value).toEqual(getAnalysisResponse);
  });

});
