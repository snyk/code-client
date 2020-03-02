import path from 'path';

import { IFiles } from '../../src/interfaces/files.interface';
import { CreateBundleRequestDto } from '../../src/dto/create-bundle.request.dto';
import { ExtendBundleRequestDto } from '../../src/dto/extend-bundle.request.dto';
import { UploadFilesRequestDto } from '../../src/dto/upload-files.request.dto';

import { sessionToken, bundleId, expiredBundleId } from './base-config';

const hashMain = '3e297985';
const hashApp = 'c8bc6452';

const root = __dirname;
const mockProjectPath = path.resolve(root, '../mocked_data');
const analysedFile = `${mockProjectPath}/sample_repository/main.js`;

export const mockFiles = [
  analysedFile,
  `${mockProjectPath}/sample_repository/sub_folder/test2.js`,
  `${mockProjectPath}/sample_repository/utf8.js`,
  `${mockProjectPath}/test.java`,
];

export const mockAnalysisResults = {
  [analysedFile]: { '0': [{ rows: [1, 2], cols: [3, 4], markers: [] }] },
  suggestions: {
    '0': {
      id: 'TestSuggestion',
      message: 'some message',
      severity: 1,
    },
  },
};

export const mockNewAnalysisResults = {
  analysisResults: {
    suggestions: {
      '0': {
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
  analysisURL: 'mock-analysis-url',
};

const files: IFiles = {
  '/home/user/repo/main.js': hashMain,
  '/home/user/repo/app.js': hashApp,
};

export const createBundleRequest = new CreateBundleRequestDto({
  sessionToken,
  files,
});

export const extendBundleRequest = new ExtendBundleRequestDto({
  sessionToken,
  bundleId,
  files,
  removedFiles: [],
});

export const extendBundleRequestExpired = new ExtendBundleRequestDto({
  sessionToken,
  bundleId: expiredBundleId,
  files,
  removedFiles: [],
});

export const uploadFilesRequest = new UploadFilesRequestDto({
  sessionToken,
  bundleId,
  content: [
    {
      fileHash: hashMain,
      fileContent: 'const module = new Module();',
    },
    {
      fileHash: hashApp,
      fileContent: 'const App = new App();',
    },
  ],
});
