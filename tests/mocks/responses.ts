
import path from 'path';

import { bundleId, sessionToken } from './base-config';

import { AnalysisStatus } from '../../src/dto/get-analysis.response.dto';

import { ERRORS, RequestTypes } from '../../src/constants/errors';

const bundleResponse = {
  bundleId,
  missingFiles: [],
  uploadURL: `https://www.deepcode.ai/publicapi/file/${bundleId}`,
};

const root = __dirname;
const mockProjectPath = path.resolve(root, '../mocked_data');
const analysedFile = `${mockProjectPath}/sample_repository/main.js`;

/**
 * Successful responses
 */
export const startSessionResponse = {
  loginURL: 'mock-login-url',
  sessionToken: bundleId
};

export const createBundleResponse = {
  ...bundleResponse,
};

export const checkBundleResponse = {
  ...bundleResponse,
};

export const extendBundleResponse = {
  ...bundleResponse,
};

export const getAnalysisResponse = {
  status: AnalysisStatus.done,
  progress: 100,
  analysisURL: 'mock-analysis-url',
  analysisResults: {
    suggestions: {
      0: {
        id: 'TestSuggestion',
        message: 'Some message',
        severity: 1,
      },
    },
    files: {
      [analysedFile]: {
        0: [
          {
            cols: [120, 150],
            rows: [140, 140],
            markers: [],
          },
        ],
      },
    },
  },
};

/**
 * Errors
 */
export const checkBundleError404 = {
  statusCode: 404,
  statusText: ERRORS[RequestTypes.checkBundle][404],
};

export const extendBundleError404 = {
  statusCode: 404,
  statusText: ERRORS[RequestTypes.extendBundle][404],
};

