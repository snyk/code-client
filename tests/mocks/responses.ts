
import path from 'path';
import { bundleId, sessionToken } from './base-config';

import ErrorResponseDto from '../../src/dto/error.response.dto';
import StartSessionResponseDto from '../../src/dto/start-session.response.dto';
import GetFiltersResponseDto from '../../src/dto/get-filters.response.dto';
import CreateBundleResponseDto from '../../src/dto/create-bundle.response.dto';
import CheckBundleResponseDto from '../../src/dto/check-bundle.response.dto';
import ExtendBundleResponseDto from '../../src/dto/extend-bundle.response.dto';
import { GetAnalysisResponseDto, AnalysisStatus } from '../../src/dto/get-analysis.response.dto';

import { ERRORS, RequestTypes } from '../../src/constants/errors';

const bundleResponse = {
  bundleId,
  missingFiles: [],
  uploadURL: 'mock-upload-url',
};

const root = __dirname;
const mockProjectPath = path.resolve(root, '../mocked_data');
const analysedFile = `${mockProjectPath}/sample_repository/main.js`;

/**
 * Successful responses
 */
export const startSessionResponse: StartSessionResponseDto = {
  sessionToken,
  loginURL: 'mock-login-url',
};

export const getFiltersResponse: GetFiltersResponseDto = {
  extensions: ['.java', '.js', '.ts', '.py'],
  configFiles: ['.eslintrc.js', '.eslintrc.json', 'tslint.json', 'pylintrc'],
};

export const createBundleResponse: CreateBundleResponseDto = {
  ...bundleResponse,
};

export const checkBundleResponse: CheckBundleResponseDto = {
  ...bundleResponse,
};

export const extendBundleResponse: ExtendBundleResponseDto = {
  ...bundleResponse,
};

export const uploadFilesResponse = true;

export const getAnalysisResponse: GetAnalysisResponseDto = {
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
export const checkBundleError404: ErrorResponseDto = {
  error: {},
  statusCode: 404,
  statusText: ERRORS[RequestTypes.checkBundle][404],
};

export const extendBundleError404: ErrorResponseDto = {
  error: {},
  statusCode: 404,
  statusText: ERRORS[RequestTypes.extendBundle][404],
};

