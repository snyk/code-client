import fs from 'fs';
import crypto, { HexBase64Latin1Encoding } from 'crypto';

import Emitter from './Emitter';

import { IFiles, IFileInfo } from '../interfaces/files.interface';
import { CRYPTO } from '../constants/files';
import { isWindows, maxPayload } from '../constants/common';

import throttle from '../utils/throttle';

type FileInfo = {
  hash: string;
  size: number;
  content: string;
};

export function getFilesData(baseDir: string, files: string[]): IFileInfo[] {
  return files.map(file => {
    const info = getFileInfo(baseDir + file);
    const path = !isWindows ? file : file.replace('\\', '/');

    return { path, ...info };
  });
}

function getFileInfo(filePath: string): FileInfo {
  const fileSize = fs.lstatSync(filePath).size;

  if (fileSize > maxPayload) {
    return {
      hash: '',
      size: 0,
      content: '',
    };
  }

  const fileContent = fs.readFileSync(filePath).toString('utf8');
  const fileHash = crypto
    .createHash(CRYPTO.algorithm)
    .update(fileContent)
    .digest(CRYPTO.hashEncode as HexBase64Latin1Encoding);

  return {
    hash: fileHash,
    size: fileSize,
    content: fileContent,
  };
}

export async function buildBundle(files: IFileInfo[]): Promise<IFiles> {
  const emitResult = throttle(Emitter.buildBundleProgress.bind(Emitter), 1000);
  const total = files.length;
  const result = files.reduce((res, fileInfo, idx) => {
    const processed = idx + 1;

    emitResult(processed, total);

    res[fileInfo.path] = fileInfo.hash;
    return res;
  }, {});

  Emitter.buildBundleFinish();

  return Promise.resolve(result);
}
