import { IFiles } from '../../src/interfaces/files.interface';
import { CreateBundleRequestDto } from '../../src/dto/create-bundle.request.dto';
import { ExtendBundleRequestDto } from '../../src/dto/extend-bundle.request.dto';
import { UploadFilesRequestDto } from '../../src/dto/upload-files.request.dto';

import { sessionToken, bundleId, expiredBundleId } from './base-config';

const hashMain = '3e297985';
const hashApp = 'c8bc6452';

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