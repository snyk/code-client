
import path from 'path';

import { ERRORS, RequestTypes } from '../../src/constants';
import { AnalysisStatus } from '../../src/http';

import { sampleProjectPath } from './base';

const analysedFile = `${sampleProjectPath}/sample_repository/app.js`;

/**
 * Successful responses
 */

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

