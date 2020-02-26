import fs from 'fs';
import crypto, { HexBase64Latin1Encoding } from 'crypto';

import { IFiles, IFileInfo } from '../interfaces/files.interface';
import { CRYPTO } from '../constants/files';
import { PLUGIN } from '../constants/common';

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

  public getFilesData(files: string[]): IFileInfo[] {
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

    if (fileSize > PLUGIN.maxPayload) {
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

  public buildBundle(files: string[]): Promise<IFiles> {
    const result = files.reduce((res, path) => {
      const fileInfo = this.getFileInfo(path);
      res[path] = fileInfo.hash;

      return res;
    }, {});

    return Promise.resolve(result);
  }
}
