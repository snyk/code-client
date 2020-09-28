import { chunk } from 'lodash';

import { IFileInfo } from './interfaces/files.interface';

import { composeFilePayloads } from './files';
import { createBundle, extendBundle, uploadFiles, IResult, RemoteBundle } from './http';
import { MAX_PAYLOAD } from './constants';
import emitter from './emitter';

export async function createRemoteBundle(
  baseURL: string,
  sessionToken: string,
  files: IFileInfo[],
  maxPayload = MAX_PAYLOAD,
): Promise<IResult<RemoteBundle> | null> {
  let response: IResult<RemoteBundle> | null = null;

  const fileChunks = chunk(files, maxPayload / 300);
  emitter.createBundleProgress(0, fileChunks.length);
  for (const [i, chunkedFiles] of fileChunks.entries()) {
    const paramFiles = Object.fromEntries(chunkedFiles.map(d => [d.bundlePath, d.hash]));

    if (response === null) {
      // eslint-disable-next-line no-await-in-loop
      response = await createBundle({
        baseURL,
        sessionToken,
        files: paramFiles,
      });
    } else {
      // eslint-disable-next-line no-await-in-loop
      response = await extendBundle({
        baseURL,
        sessionToken,
        bundleId: response.value.bundleId,
        files: paramFiles,
      });
    }

    emitter.createBundleProgress(i + 1, fileChunks.length);

    if (response.type === 'error') {
      // TODO: process Error
      return response;
    }
  }

  return response;
}

/**
 * Splits files in buckets and upload in parallel
 * @param baseURL
 * @param sessionToken
 * @param remoteBundle
 */
export async function uploadRemoteBundle(
  baseURL: string,
  sessionToken: string,
  bundleId: string,
  files: IFileInfo[],
  maxPayload = MAX_PAYLOAD,
): Promise<boolean> {
  let uploadedFiles = 0;
  emitter.uploadBundleProgress(0, files.length);

  const uploadFileChunks = async (bucketFiles: IFileInfo[]): Promise<boolean> => {
    const resp = await uploadFiles({
      baseURL,
      sessionToken,
      bundleId,
      content: bucketFiles.map(f => {
        return { fileHash: f.hash, fileContent: f.content || '' };
      }),
    });

    if (resp.type !== 'error') {
      uploadedFiles += bucketFiles.length;
      emitter.uploadBundleProgress(uploadedFiles, files.length);
      return true;
    }

    return false;
  };

  const tasks = [];
  for (const bucketFiles of composeFilePayloads(files, maxPayload)) {
    tasks.push(uploadFileChunks(bucketFiles));
  }

  if (tasks.length) {
    return (await Promise.all(tasks)).some(r => !!r);
  }
  return true;
}
