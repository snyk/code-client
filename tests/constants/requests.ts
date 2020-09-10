import path from 'path';

import { IFiles } from '../../src/interfaces/files.interface';

import { defaultBaseURL as baseURL } from '../../src/constants/common';
import { sessionToken, bundleId } from './base';

const hashMain = '3e297985';
const hashApp = 'c8bc6452';

export const sampleProjectPath = path.resolve(__dirname, '../sample-repo');

const files: IFiles = {
  '/home/user/repo/main.js': hashMain,
  '/home/user/repo/app.js': hashApp,
};

export const createBundleRequest = {
  baseURL,
  sessionToken,
  files,
};

export const extendBundleRequest = {
  baseURL,
  sessionToken,
  bundleId,
  files,
  removedFiles: [],
};

export const extendBundleRequestExpired = {
  baseURL,
  sessionToken,
  bundleId: 'expired-bundle-id',
  files,
  removedFiles: [],
};

export const uploadFilesRequest = {
  baseURL,
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
};

export const reportTelemetryRequest = {
  baseURL,
  sessionToken,
  bundleId,
  source: 'testSource',
  type: 'testType',
  message: 'testMessage',
  path: '/test/path',
  data: {
    foo: 'bar',
    bar: [
      'fo',
      'foo',
      'fooo'
    ]
  }
};
