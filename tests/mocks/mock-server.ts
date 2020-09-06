import nock, { Scope } from 'nock';

import { defaultBaseURL as baseURL, apiPath } from '../../src/constants/common';
import { bundleId, expiredBundleId } from './base-config';
import {
  startSessionResponse,
  getFiltersResponse,
  createBundleResponse,
  checkBundleResponse,
  extendBundleResponse,
  getAnalysisResponse,

  checkBundleError404,
} from './responses';
import { mockNewAnalysisResults } from './requests';

export function startMockServer(): void {

  const mockServer = nock(`${baseURL}${apiPath}`);

  agentSuccess(mockServer);
  agentError(mockServer);

  startSessionSuccess(mockServer);
  checkSessionSuccess(mockServer);
  getFiltersSuccess(mockServer);
  createBundleSuccess(mockServer);
  checkBundleSuccess(mockServer);
  extendBundleSuccess(mockServer);
  uploadFilesSuccess(mockServer);
  getAnalysisSuccess(mockServer);
  getAnalysisResult(mockServer);
  reportError(mockServer);
  reportEvent(mockServer);

  checkBundleError(mockServer);
  extendBundleError(mockServer);
  createNewBundleSuccess(mockServer);
}

function agentSuccess(mockServer: Scope): void {
  mockServer.get('/agent-response').reply(200, {
    name: 'agent',
  });
}

function agentError(mockServer: Scope): void {
  mockServer
    .get('/agent-error')
    .reply(404, new Error('Not found'));
}

/**
 * Successful requests
 */
function startSessionSuccess(mockServer: Scope): void {
  mockServer
    .post('/login')
    .reply(200, startSessionResponse);
}

function reportError(mockServer: Scope): void {
  mockServer
    .post('/error')
    .reply(200, 'OK');
}

function reportEvent(mockServer: Scope): void {
  mockServer
    .post('/track')
    .reply(200, 'OK');
}

function checkSessionSuccess(mockServer: Scope): void {
  // URL looks like '/session?cache=270956.22901860584'
  mockServer
    .get(/\/session\?cache=\d+\.\d+/)
    .reply(200, 'true');
}

function getFiltersSuccess(mockServer: Scope): void {
  mockServer
    .get('/filters')
    .reply(200, getFiltersResponse);
}

function createBundleSuccess(mockServer: Scope): void {
  mockServer
    .post('/bundle')
    .reply(200, createBundleResponse);
}

function checkBundleSuccess(mockServer: Scope): void {
  mockServer
    .get(`/bundle/${bundleId}`)
    .reply(200, checkBundleResponse);
}

function createNewBundleSuccess(mockServer: Scope): void {
  mockServer
    .post(`/bundle/${bundleId}`)
    .reply(200, checkBundleResponse);
}

function extendBundleSuccess(mockServer: Scope): void {
  mockServer
    .put(`/bundle/${bundleId}`)
    .reply(200, extendBundleResponse);
}

function uploadFilesSuccess(mockServer: Scope): void {
  mockServer
    .post(`/file/${bundleId}`)
    .reply(200, 'OK');
}

function getAnalysisSuccess(mockServer: Scope): void {
  mockServer
    .get(`/analysis/${bundleId}`)
    .reply(200, getAnalysisResponse);
}

function getAnalysisResult(mockServer: Scope): void {
  mockServer
    .post(`/bundle`)
    .reply(200, mockNewAnalysisResults);
}

/**
 * Errors
 */
function checkBundleError(mockServer: Scope): void {
  mockServer
    .get(`/bundle/${expiredBundleId}`)
    .reply(404, checkBundleError404);
}

function extendBundleError(mockServer: Scope): void {
  mockServer
    .put(`/bundle/${expiredBundleId}`)
    .reply(404, extendBundleResponse);
}
