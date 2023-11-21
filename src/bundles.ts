/* eslint-disable no-await-in-loop */
import pick from 'lodash.pick';
import omit from 'lodash.omit';
import pMap from 'p-map';

import { BundleFiles, FileInfo, SupportedFiles } from './interfaces/files.interface';

import {
  composeFilePayloads,
  resolveBundleFiles,
  collectFilePolicies,
  determineBaseDir,
  collectBundleFiles,
} from './files';

import {
  CreateBundleErrorCodes,
  CheckBundleErrorCodes,
  ExtendBundleErrorCodes,
  createBundle,
  extendBundle,
  checkBundle,
  Result,
  RemoteBundle,
  ConnectionOptions,
  getFilters,
} from './http';

import { MAX_RETRY_ATTEMPTS, MAX_UPLOAD_ATTEMPTS, UPLOAD_CONCURRENCY } from './constants';
import { emitter } from './emitter';
import { AnalyzeFoldersOptions } from './interfaces/analysis-options.interface';

type BundleErrorCodes = CreateBundleErrorCodes | CheckBundleErrorCodes | ExtendBundleErrorCodes;

interface PrepareRemoteBundleOptions extends ConnectionOptions {
  files: FileInfo[];
  bundleHash?: string;
  removedFiles?: string[];
}

async function* prepareRemoteBundle(
  options: PrepareRemoteBundleOptions,
): AsyncGenerator<Result<RemoteBundle, BundleErrorCodes>> {
  let response: Result<RemoteBundle, BundleErrorCodes>;
  let { bundleHash } = options;
  let cumulativeProgress = 0;
  emitter.createBundleProgress(cumulativeProgress, options.files.length);
  for (const chunkedFiles of composeFilePayloads(options.files)) {
    const apiParams = {
      ...pick(options, [
        'baseURL',
        'sessionToken',
        'source',
        'extraHeaders',
        'removedFiles',
        'requestId',
        'org',
        'orgId',
      ]),
      files: chunkedFiles.reduce((d, f) => {
        // deepcode ignore PrototypePollution: FP this is an internal code
        d[f.bundlePath] = f.hash;
        return d;
      }, {} as BundleFiles),
    };

    if (!bundleHash) {
      // eslint-disable-next-line no-await-in-loop
      response = await createBundle(apiParams);
    } else {
      // eslint-disable-next-line no-await-in-loop
      response = await extendBundle({ bundleHash, ...apiParams });
    }

    cumulativeProgress += chunkedFiles.length;
    emitter.createBundleProgress(cumulativeProgress, options.files.length);

    if (response.type === 'error') {
      // TODO: process Error
      yield response;
      break;
    }
    bundleHash = response.value.bundleHash;

    yield response;
  }
}

interface UpdateRemoteBundleOptions extends ConnectionOptions {
  bundleHash: string;
  files: FileInfo[];
}

/**
 * Splits files in buckets and upload in parallel
 * @param baseURL
 * @param sessionToken
 * @param remoteBundle
 */
export async function uploadRemoteBundle(options: UpdateRemoteBundleOptions): Promise<void> {
  let uploadedFiles = 0;
  emitter.uploadBundleProgress(0, options.files.length);
  const apiParams = pick(options, [
    'baseURL',
    'sessionToken',
    'source',
    'bundleHash',
    'requestId',
    'org',
    'orgId',
    'extraHeaders',
  ]);

  const uploadFileChunks = async (bucketFiles: FileInfo[]): Promise<void> => {
    // Note: we specifically create __new__ isolated bundles here to faster files upload
    const resp = await createBundle({
      ...apiParams,
      files: bucketFiles.reduce((d, f) => {
        d[f.bundlePath] = pick(f, ['hash', 'content']);
        return d;
      }, {}),
    });

    if (resp.type !== 'error') {
      uploadedFiles += bucketFiles.length;
      emitter.uploadBundleProgress(uploadedFiles, options.files.length);
    }
  };

  const files: FileInfo[][] = [];
  for (const bucketFiles of composeFilePayloads(options.files)) {
    files.push(bucketFiles);
  }
  await pMap(files, async (task: FileInfo[]) => await uploadFileChunks(task), {
    concurrency: UPLOAD_CONCURRENCY,
  });
}

interface FullfillRemoteBundleOptions extends ConnectionOptions {
  baseDir: string;
  remoteBundle: RemoteBundle;
  maxAttempts?: number;
}

async function fullfillRemoteBundle(options: FullfillRemoteBundleOptions): Promise<RemoteBundle> {
  // Fulfill remote bundle by uploading only missing files (splitted in chunks)
  // Check remove bundle to make sure no missing files left
  let attempts = 0;
  let { remoteBundle } = options;
  const connectionOptions = pick(options, [
    'baseURL',
    'sessionToken',
    'source',
    'requestId',
    'org',
    'orgId',
    'extraHeaders',
  ]);

  while (remoteBundle.missingFiles.length && attempts < (options.maxAttempts || MAX_UPLOAD_ATTEMPTS)) {
    const missingFiles = await resolveBundleFiles(options.baseDir, remoteBundle.missingFiles);
    await uploadRemoteBundle({
      ...connectionOptions,
      bundleHash: remoteBundle.bundleHash,
      files: missingFiles,
    });

    const bundleResponse = await checkBundle({ ...connectionOptions, bundleHash: remoteBundle.bundleHash });
    if (bundleResponse.type === 'error') {
      throw new Error('Failed to get remote bundle');
    }
    // eslint-disable-next-line no-param-reassign
    remoteBundle = bundleResponse.value;
    attempts += 1;
  }
  return remoteBundle;
}

interface RemoteBundleFactoryOptions extends PrepareRemoteBundleOptions {
  baseDir: string;
}

export async function remoteBundleFactory(options: RemoteBundleFactoryOptions): Promise<RemoteBundle | null> {
  let remoteBundle: RemoteBundle | null = null;
  const baseOptions = pick(options, [
    'baseURL',
    'sessionToken',
    'source',
    'baseDir',
    'requestId',
    'org',
    'orgId',
    'extraHeaders',
  ]);
  const bundleFactory = prepareRemoteBundle(omit(options, ['baseDir']));
  for await (const response of bundleFactory) {
    if (response.type === 'error') {
      throw response.error;
    }

    remoteBundle = await fullfillRemoteBundle({ ...baseOptions, remoteBundle: response.value });
    if (remoteBundle.missingFiles.length) {
      throw new Error(`Failed to upload # files: ${remoteBundle.missingFiles.length}`);
    }
  }

  return remoteBundle;
}

/**
 * Get supported filters and test baseURL for correctness and availability
 *
 * @param baseURL
 * @param source
 * @returns
 */
export async function getSupportedFiles(
  baseURL: string,
  source: string,
  requestId?: string,
  languages?: string[],
  orgId?: string,
  extraHeaders?: Record<string, string>,
): Promise<SupportedFiles> {
  emitter.supportedFilesLoaded(null);
  const resp = await getFilters({
    baseURL,
    source,
    orgId,
    requestId,
    attempts: MAX_RETRY_ATTEMPTS,
    extraHeaders: extraHeaders ?? {},
  });
  if (resp.type === 'error') {
    throw resp.error;
  }
  const supportedFilesFromApi = resp.value;
  //Given supported languages from 'registy'
  if (languages) {
    const supportedFiles: SupportedFiles = {
      configFiles: supportedFilesFromApi.configFiles,
      extensions: languages,
    };

    //For verification only
    // Make sure we compare file extensions between results from `registry` and `deeproxy` without case sensitivity to avoid missing some of supported extensions.
    const userSupportedExtensions = supportedFilesFromApi.extensions.map(e => e.toLowerCase());
    supportedFiles.extensions = supportedFiles.extensions.filter(langExtension =>
      userSupportedExtensions.includes(langExtension.toLowerCase()),
    );
    emitter.supportedFilesLoaded(supportedFiles);
    return supportedFiles;
  }
  emitter.supportedFilesLoaded(supportedFilesFromApi);
  return supportedFilesFromApi;
}

export interface FileBundle extends RemoteBundle {
  baseDir: string;
  supportedFiles: SupportedFiles;
  fileIgnores: string[];
  skippedOversizedFiles?: string[];
}

export interface CreateBundleFromFoldersOptions extends ConnectionOptions, AnalyzeFoldersOptions {
  // pass
}

/**
 * Creates a remote bundle and returns response from the bundle API
 *
 * @param {CreateBundleFromFoldersOptions} options
 * @returns {Promise<FileBundle | null>}
 */
export async function createBundleFromFolders(options: CreateBundleFromFoldersOptions): Promise<FileBundle | null> {
  // Fetch supported files to save network traffic
  const supportedFiles = await getSupportedFiles(
    options.baseURL,
    options.source,
    options.requestId,
    options.languages,
    options.orgId,
    options.extraHeaders,
  );

  // Collect files and create a remote bundle
  return await createBundleWithCustomFiles(options, supportedFiles);
}

/**
 * Creates a remote bundle and returns response from the bundle API
 * This function is used to create a bundle with a custom list of supported file extensions
 *
 * @param {CreateBundleFromFoldersOptions} options
 * @param {SupportedFiles} supportedFiles
 * @returns {Promise<FileBundle | null>}
 */
export async function createBundleWithCustomFiles(
  options: CreateBundleFromFoldersOptions,
  supportedFiles: SupportedFiles,
): Promise<FileBundle | null> {
  // Scan for custom ignore rules
  const filePolicies = await collectFilePolicies(options.paths, options.symlinksEnabled, options.defaultFileIgnores);

  const baseDir = determineBaseDir(options.paths);
  emitter.scanFilesProgress(0);
  const bundleFiles = [];
  const skippedOversizedFiles = [];
  let totalFiles = 0;
  const bundleFileCollector = collectBundleFiles({
    ...pick(options, ['paths', 'symlinksEnabled']),
    baseDir,
    filePolicies,
    supportedFiles,
  });
  for await (const f of bundleFileCollector) {
    typeof f == 'string' ? skippedOversizedFiles.push(f) : bundleFiles.push(f);
    totalFiles += 1;
    emitter.scanFilesProgress(totalFiles);
  }

  const bundleOptions = {
    ...pick(options, ['baseURL', 'sessionToken', 'source', 'requestId', 'org', 'orgId', 'extraHeaders']),
    baseDir,
    files: bundleFiles,
  };

  // Create remote bundle
  if (!bundleFiles.length) return null;

  const remoteBundle = await remoteBundleFactory(bundleOptions);
  if (remoteBundle === null) return null;

  return {
    ...remoteBundle,
    baseDir,
    supportedFiles,
    fileIgnores: [...filePolicies.excludes, ...filePolicies.ignores],
    skippedOversizedFiles,
  };
}
