import * as crypto from 'crypto';
import * as nodePath from 'path';
import { Buffer } from 'buffer';
import * as fs from 'fs';
import { CustomDCIgnore, DefaultDCIgnore } from '@deepcode/dcignore';
import {
  HASH_ALGORITHM,
  ENCODE_TYPE,
  GITIGNORE_FILENAME,
  DCIGNORE_FILENAME,
  FILE_CURRENT_STATUS,
  ALLOWED_PAYLOAD_SIZE,
} from '../constants/files';

import { PayloadMissingFileInterface, ISupportedFiles } from '../interfaces/files.interface';

export const DCIGNORE_DRAFTS = {
  custom: CustomDCIgnore,
  default: DefaultDCIgnore,
};

// The file limit was hardcoded to 2mb but seems to be a function of ALLOWED_PAYLOAD_SIZE
// TODO what exactly is transmitted eventually and what is a good exact limit?
const SAFE_PAYLOAD_SIZE = ALLOWED_PAYLOAD_SIZE / 2; // safe size for requests

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

export let filesProgress = { processed: 0, total: 0 };

export let serverFilesFilterList: ISupportedFiles = {
  configFiles: [],
  extensions: [],
};

export const acceptFileToBundle = (name: string): boolean => {
  name = nodePath.basename(name);
  return (
    (serverFilesFilterList.configFiles || []).includes(name) ||
    (serverFilesFilterList.extensions || []).includes(nodePath.extname(name))
  );
};

export const isFileChangingBundle = (name: string): boolean => {
  name = nodePath.basename(name);
  return name === GITIGNORE_FILENAME || name === DCIGNORE_FILENAME;
};

export const parseGitignoreFile = async (filePath: string): Promise<string[]> => {
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

export const compareFileChanges = async (
  filePath: string,
  currentWorkspacePath: string,
  currentWorkspaceFilesBundle: { [key: string]: string } | null,
): Promise<{ [key: string]: string }> => {
  const filePathInsideBundle = filePath.split(currentWorkspacePath)[1];
  const response: { [key: string]: string } = {
    fileHash: '',
    filePath: filePathInsideBundle,
    status: '',
  };
  const { same, modified, created, deleted } = FILE_CURRENT_STATUS;
  try {
    const fileHash = await createFileHash(readFileSync(filePath));
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

export const processPayloadSize = (
  payload: Array<PayloadMissingFileInterface>,
): {
  chunks: boolean;
  payload: Array<PayloadMissingFileInterface> | Array<Array<PayloadMissingFileInterface>>;
} => {
  const buffer = Buffer.from(JSON.stringify(payload));
  const payloadByteSize = Buffer.byteLength(buffer);

  if (payloadByteSize < ALLOWED_PAYLOAD_SIZE) {
    return { chunks: false, payload };
  }
  const chunkedPayload = splitPayloadIntoChunks(payload);
  return chunkedPayload;
};

export const splitPayloadIntoChunks = (
  payload: {
    fileHash: string;
    filePath: string;
    fileContent: string;
  }[],
) => {
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
