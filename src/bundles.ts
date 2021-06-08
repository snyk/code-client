/* eslint-disable no-await-in-loop */
import chunk from 'lodash.chunk';
import pick from 'lodash.pick';

import { BundleFiles, FileInfo } from './interfaces/files.interface';

import { composeFilePayloads, resolveBundleFiles } from './files';
import {
  CreateBundleErrorCodes,
  CheckBundleErrorCodes,
  ExtendBundleErrorCodes,
  createBundle,
  extendBundle,
  checkBundle,
  Result,
  RemoteBundle,
} from './http';
import { MAX_PAYLOAD, MAX_UPLOAD_ATTEMPTS } from './constants';
import emitter from './emitter';

type BundleErrorCodes = CreateBundleErrorCodes | CheckBundleErrorCodes | ExtendBundleErrorCodes;

async function* prepareRemoteBundle(
  baseURL: string,
  sessionToken: string,
  files: FileInfo[],
  removedFiles: string[] = [],
  existingBundleHash: string | null = null,
  maxPayload = MAX_PAYLOAD,
  source: string,
): AsyncGenerator<Result<RemoteBundle, BundleErrorCodes>> {
  let response: Result<RemoteBundle, BundleErrorCodes>;
  let bundleHash = existingBundleHash;

  const fileChunks = chunk(files, maxPayload / 300);
  emitter.createBundleProgress(0, fileChunks.length);
  for (const [i, chunkedFiles] of fileChunks.entries()) {
    const paramFiles = chunkedFiles.reduce((d, f) => ({ ...d, [f.bundlePath]: f.hash }), {} as BundleFiles);

    if (bundleHash === null) {
      // eslint-disable-next-line no-await-in-loop
      response = await createBundle({
        baseURL,
        sessionToken,
        files: paramFiles,
        source,
      });
    } else {
      // eslint-disable-next-line no-await-in-loop
      response = await extendBundle({
        baseURL,
        sessionToken,
        bundleHash,
        files: paramFiles,
        removedFiles,
      });
    }

    emitter.createBundleProgress(i + 1, fileChunks.length);

    if (response.type === 'error') {
      // TODO: process Error
      yield response;
      break;
    }
    bundleHash = response.value.bundleHash;

    yield response;
  }
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
  bundleHash: string,
  files: FileInfo[],
  maxPayload = MAX_PAYLOAD,
): Promise<boolean> {
  let uploadedFiles = 0;
  emitter.uploadBundleProgress(0, files.length);

  const uploadFileChunks = async (bucketFiles: FileInfo[]): Promise<boolean> => {
    const resp = await extendBundle({
      baseURL,
      sessionToken,
      bundleHash,
      files: bucketFiles.reduce((d, f) => ({ ...d, [f.bundlePath]: pick(f, ['hash', 'content']) }), {}),
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

async function fullfillRemoteBundle(
  baseURL: string,
  sessionToken: string,
  baseDir: string,
  remoteBundle: RemoteBundle,
  maxPayload = MAX_PAYLOAD,
  maxAttempts = MAX_UPLOAD_ATTEMPTS,
): Promise<RemoteBundle> {
  // Fulfill remote bundle by uploading only missing files (splitted in chunks)
  // Check remove bundle to make sure no missing files left
  let attempts = 0;
  while (remoteBundle.missingFiles.length && attempts < maxAttempts) {
    const missingFiles = await resolveBundleFiles(baseDir, remoteBundle.missingFiles);
    const isUploaded = await uploadRemoteBundle(
      baseURL,
      sessionToken,
      remoteBundle.bundleHash,
      missingFiles,
      maxPayload,
    );
    if (!isUploaded) {
      throw new Error('Failed to upload some files');
    }
    const bundleResponse = await checkBundle({
      baseURL,
      sessionToken,
      bundleHash: remoteBundle.bundleHash,
    });
    if (bundleResponse.type === 'error') {
      throw new Error('Failed to get remote bundle');
    }
    // eslint-disable-next-line no-param-reassign
    remoteBundle = bundleResponse.value;
    attempts += 1;
  }
  return remoteBundle;
}

export async function remoteBundleFactory(
  baseURL: string,
  sessionToken: string,
  files: FileInfo[],
  removedFiles: string[] = [],
  baseDir: string,
  existingBundleHash: string | null = null,
  maxPayload = MAX_PAYLOAD,
  source: string,
): Promise<RemoteBundle | null> {
  const bundleFactory = prepareRemoteBundle(
    baseURL,
    sessionToken,
    files,
    removedFiles,
    existingBundleHash,
    maxPayload,
    source,
  );
  let remoteBundle: RemoteBundle | null = null;

  for await (const response of bundleFactory) {
    if (response.type === 'error') {
      throw response.error;
    }

    remoteBundle = await fullfillRemoteBundle(baseURL, sessionToken, baseDir, response.value, maxPayload);
    if (remoteBundle.missingFiles.length) {
      throw new Error(`Failed to upload # files: ${remoteBundle.missingFiles.length}`);
    }
  }

  return remoteBundle;
}
