import * as nodePath from 'path';
import { Buffer } from 'buffer';
import * as fs from 'fs';
import crypto, { HexBase64Latin1Encoding } from 'crypto';
import { throttle } from 'lodash';
import { CustomDCIgnore, DefaultDCIgnore } from '@deepcode/dcignore';

import {
  HASH_ALGORITHM,
  ENCODE_TYPE,
  GITIGNORE_FILENAME,
  DCIGNORE_FILENAME,
  FILE_CURRENT_STATUS,
  MAX_PAYLOAD,
} from './constants';

import emitter from './emitter';
import { IFiles, IFileInfo, PayloadMissingFileInterface, ISupportedFiles } from './interfaces/files.interface';

export const isWindows = nodePath.sep === '\\';

type FileInfo = {
  hash: string;
  size: number;
  content: string;
};

export const DCIGNORE_DRAFTS = {
  custom: CustomDCIgnore,
  default: DefaultDCIgnore,
};

// The file limit was hardcoded to 2mb but seems to be a function of MAX_PAYLOAD
// TODO what exactly is transmitted eventually and what is a good exact limit?
const SAFE_PAYLOAD_SIZE = MAX_PAYLOAD / 2; // safe size for requests

export const createFileHash = (file: string): string => {
  return crypto.createHash(HASH_ALGORITHM).update(file).digest(ENCODE_TYPE);
};

export const readFileSync = (filePath: string): string => {
  return fs.readFileSync(filePath, { encoding: 'utf8' });
};

export const getFileNameFromPath = (path: string): string => {
  const splittedPath = path.split('/');
  return splittedPath[splittedPath.length - 1];
};

export const filesProgress = { processed: 0, total: 0 };

export const supportedFiles: ISupportedFiles = {
  extensions: [
    '.py',
    '.c',
    '.cc',
    '.cpp',
    '.cxx',
    '.h',
    '.hpp',
    '.hxx',
    '.es',
    '.es6',
    '.htm',
    '.html',
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    '.vue',
    '.java',
  ],
  configFiles: [
    '.dcignore',
    '.gitignore',
    '.pylintrc',
    'pylintrc',
    '.pmdrc.xml',
    '.ruleset.xml',
    'ruleset.xml',
    'tslint.json',
    '.eslintrc.js',
    '.eslintrc.json',
    '.eslintrc.yml',
  ],
};

export const acceptFileToBundle = (name: string): boolean => {
  const checkName = nodePath.basename(name);
  return (
    (supportedFiles.configFiles || []).includes(checkName) ||
    (supportedFiles.extensions || []).includes(nodePath.extname(checkName))
  );
};

export const isFileChangingBundle = (name: string): boolean => {
  return [GITIGNORE_FILENAME, DCIGNORE_FILENAME].includes(nodePath.basename(name));
};

export const parseGitignoreFile = (filePath: string): string[] => {
  const gitignoreContent: string | string[] = readFileSync(filePath);
  return gitignoreContent.split('\n').filter(file => !!file);
};

export const createMissingFilesPayloadUtil = async (
  missingFiles: Array<string>,
  currentWorkspacePath: string,
): Promise<Array<PayloadMissingFileInterface>> => {
  const result: {
    fileHash: string;
    filePath: string;
    fileContent: string;
  }[] = [];
  for await (const file of missingFiles) {
    if (currentWorkspacePath) {
      const filePath = `${currentWorkspacePath}${file}`;
      const fileContent = readFileSync(filePath);
      result.push({
        fileHash: createFileHash(fileContent),
        filePath,
        fileContent,
      });
    }
  }
  return result;
};

export const compareFileChanges = (
  filePath: string,
  currentWorkspacePath: string,
  currentWorkspaceFilesBundle: { [key: string]: string } | null,
): { [key: string]: string } => {
  const filePathInsideBundle = filePath.split(currentWorkspacePath)[1];
  const response: { [key: string]: string } = {
    fileHash: '',
    filePath: filePathInsideBundle,
    status: '',
  };
  const { same, modified, created, deleted } = FILE_CURRENT_STATUS;
  try {
    const fileHash = createFileHash(readFileSync(filePath));
    response.fileHash = fileHash;
    if (currentWorkspaceFilesBundle) {
      if (currentWorkspaceFilesBundle[filePathInsideBundle]) {
        response.status = fileHash === currentWorkspaceFilesBundle[filePathInsideBundle] ? same : modified;
      } else {
        response.status = created;
      }
    }
  } catch (err) {
    if (currentWorkspaceFilesBundle && currentWorkspaceFilesBundle[filePathInsideBundle]) {
      response.status = deleted;
      return response;
    }
    throw err;
  }
  return response;
};

export const splitPayloadIntoChunks = (
  payload: {
    fileHash: string;
    filePath: string;
    fileContent: string;
  }[],
): {
  chunks: boolean;
  payload: Array<PayloadMissingFileInterface> | Array<Array<PayloadMissingFileInterface>>;
} => {
  const chunkedPayload = [];

  // Break input array of files
  //     [  {hash1, content1},    {hash2, content2},   ...]
  // into array of chunks limited by an upper size bound to avoid http 413 errors
  //     [  [{hash1, content1}],  [{hash2, content2}, {hash3, content3}]  ]
  let currentChunkSize = 0;
  for (const p of payload) {
    const currentChunkElement = p;
    const currentWorstCaseChunkElementSize = Buffer.byteLength(Buffer.from(JSON.stringify(currentChunkElement)));
    const lastChunk = chunkedPayload[chunkedPayload.length - 1];

    if (!lastChunk || currentChunkSize + currentWorstCaseChunkElementSize > SAFE_PAYLOAD_SIZE) {
      // Start a new chunk
      chunkedPayload.push([p]);
      currentChunkSize = currentWorstCaseChunkElementSize;
    } else {
      // Append item to current chunk
      lastChunk.push(p);
      currentChunkSize += currentWorstCaseChunkElementSize;
    }
  }

  return { chunks: true, payload: chunkedPayload };
};

export const processPayloadSize = (
  payload: Array<PayloadMissingFileInterface>,
): {
  chunks: boolean;
  payload: Array<PayloadMissingFileInterface> | Array<Array<PayloadMissingFileInterface>>;
} => {
  const buffer = Buffer.from(JSON.stringify(payload));
  const payloadByteSize = Buffer.byteLength(buffer);

  if (payloadByteSize < MAX_PAYLOAD) {
    return { chunks: false, payload };
  }
  return splitPayloadIntoChunks(payload);
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

  if (fileSize > MAX_PAYLOAD) {
    return {
      hash: '',
      size: 0,
      content: '',
    };
  }

  const fileContent = fs.readFileSync(filePath).toString('utf8');
  const fileHash = crypto
    .createHash(HASH_ALGORITHM)
    .update(fileContent)
    .digest(ENCODE_TYPE as HexBase64Latin1Encoding);

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

export function getMissingFilesInfo(missingFiles: string[], filesInfo: IFileInfo[]): IFileInfo[] {
  const missingFilesData: IFileInfo[] = [];

  return missingFiles.reduce((resultArr, missingFile) => {
    const fullInfo = filesInfo.find(fileInfo => fileInfo.path === missingFile);

    if (fullInfo) {
      resultArr.push(fullInfo);
    }

    return resultArr;
  }, missingFilesData);
}
