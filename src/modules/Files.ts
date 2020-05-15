import fs from 'fs';
import crypto, { HexBase64Latin1Encoding } from 'crypto';

import { Emitter } from './Emitter';

import { IFiles, IFileInfo } from '../interfaces/files.interface';
import { CRYPTO } from '../constants/files';
import { maxPayload } from '../constants/common';

import { throttle } from '../utils/throttle';

type FileInfo = {
  hash: string;
  size: number;
  content: string;
};

export class Files {
  private readFileContent(filePath: string): string {
    return fs.readFileSync(filePath, { encoding: CRYPTO.fileEncode });
  }

  private createFileContent(filePath: string): string {
    const fileContent = this.readFileContent(filePath);
    return fileContent;
  }

  private createFileHash(fileContent: string): string {
    return crypto
      .createHash(CRYPTO.algorithm)
      .update(fileContent)
      .digest(CRYPTO.hashEncode as HexBase64Latin1Encoding);
  }

  public async getFilesData(files: string[]): Promise<IFileInfo[]> {
    const result = files.map(file => {
      const { hash, size, content } = this.getFileInfo(file);

      return {
        path: file,
        size,
        hash,
        content,
      };
    });

    return result;
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

    const fileContent = this.createFileContent(filePath);
    const fileHash = this.createFileHash(fileContent);

    return {
      hash: fileHash,
      size: fileSize,
      content: fileContent,
    };
  }

  public async buildBundle(files: string[]): Promise<IFiles> {
    const emitResult = throttle(Emitter.buildBundleProgress, 1000);
    const total = files.length;

    const result = files.reduce((res, path, idx) => {
      const processed = idx + 1;
      const fileInfo = this.getFileInfo(path);
      res[path] = fileInfo.hash;

      emitResult(processed, total);
      return res;
    }, {});

    Emitter.buildBundleFinish();

    return Promise.resolve(result);
  }
}
