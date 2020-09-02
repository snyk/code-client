import fs from 'fs';
import crypto, { HexBase64Latin1Encoding } from 'crypto';

import { Emitter } from './Emitter';

import { IFiles, IFileInfo } from '../interfaces/files.interface';
import { CRYPTO } from '../constants/files';
import { isWindows, maxPayload } from '../constants/common';

import { throttle } from '../utils/throttle';

type FileInfo = {
  hash: string;
  size: number;
  content: string;
};

export class Files {
  private readFileContent(filePath: string): string {
    return fs.readFileSync(filePath).toString('utf8');
  }

  private createFileHash(fileContent: string): string {
    return crypto
      .createHash(CRYPTO.algorithm)
      .update(fileContent)
      .digest(CRYPTO.hashEncode as HexBase64Latin1Encoding);
  }

  public async getFilesData(baseDir: string, files: string[]): Promise<IFileInfo[]> {
    return files.map(file => {
      const info = this.getFileInfo(baseDir + file);
      const path = !isWindows ? file : file.replace('\\', '/');

      return { path, ...info };
    });
  }

  private getFileInfo(filePath: string): FileInfo {
    const fileSize = fs.lstatSync(filePath).size;

    if (fileSize > maxPayload) {
      return {
        hash: '',
        size: 0,
        content: '',
      };
    }

    const fileContent = this.readFileContent(filePath);
    const fileHash = this.createFileHash(fileContent);

    return {
      hash: fileHash,
      size: fileSize,
      content: fileContent,
    };
  }

  public async buildBundle(files: IFileInfo[]): Promise<IFiles> {
    const emitResult = throttle(Emitter.buildBundleProgress, 1000);
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
}
