/* eslint-disable no-await-in-loop */

import {
  collectIgnoreRules,
  collectBundleFiles,
  prepareExtendingBundle,
  determineBaseDir,
  resolveBundleFilePath,
} from './files';
import parseGitUri from './gitUtils';
import {
  getFilters,
  createGitBundle,
  GetAnalysisErrorCodes,
  getAnalysis,
  AnalysisStatus,
  IResult,
  GetAnalysisResponseDto,
  AnalysisFailedResponse,
  AnalysisFinishedResponse,
} from './http';
import emitter from './emitter';
import { defaultBaseURL, MAX_PAYLOAD, IGNORES_DEFAULT } from './constants';
import { prepareRemoteBundle, fullfillRemoteBundle } from './bundles';

<<<<<<< HEAD
import { IFileInfo } from './interfaces/files.interface';
import { AnalysisSeverity, IGitBundle, IFileBundle,} from './interfaces/analysis-result.interface';
// import Sarif from './sarif_converter';
// 1. Create a bundle for paths from scratch. Return bundle info together with request details and analysis results. Create a class Bundle for this
// 2. class Bundle will implement method extend, that will conduct analysis and return another Bundle instance
// 3. Create a queue, that would manage bundle extensions

async function createRemoteBundle(
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
=======
import { AnalysisSeverity, IGitBundle, IFileBundle, IBundleResult } from './interfaces/analysis-result.interface';
>>>>>>> big-refactoring

async function pollAnalysis(
  baseURL: string,
  sessionToken: string,
  bundleId: string,
  useLinters: boolean,
  severity: AnalysisSeverity,
): Promise<IResult<AnalysisFailedResponse | AnalysisFinishedResponse, GetAnalysisErrorCodes>> {
  let analysisResponse: IResult<GetAnalysisResponseDto, GetAnalysisErrorCodes>;
  let analysisData: GetAnalysisResponseDto;

  emitter.analyseProgress({
    status: AnalysisStatus.fetching,
    progress: 0,
  });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    analysisResponse = await getAnalysis({
      baseURL,
      sessionToken,
      bundleId,
      useLinters,
      severity,
    });

    if (analysisResponse.type === 'error') {
      return analysisResponse;
    }

    analysisData = analysisResponse.value;

    if (
      analysisData.status === AnalysisStatus.fetching ||
      analysisData.status === AnalysisStatus.analyzing ||
      analysisData.status === AnalysisStatus.dcDone
    ) {
      // Report progress of fetching
      emitter.analyseProgress(analysisData);
    } else if (analysisData.status === AnalysisStatus.done) {
      // Return data of analysis
      return analysisResponse as IResult<AnalysisFinishedResponse, GetAnalysisErrorCodes>;
      // deepcode ignore DuplicateIfBody: false positive it seems that interface is not taken into account
    } else if (analysisData.status === AnalysisStatus.failed) {
      // Report failure of analysing
      return analysisResponse as IResult<AnalysisFailedResponse, GetAnalysisErrorCodes>;
    }
  }
}

export async function analyzeBundle(
  baseURL = defaultBaseURL,
  sessionToken = '',
  includeLint = false,
  severity = AnalysisSeverity.info,
  bundleId: string,
  baseDir = '',
): Promise<IBundleResult> {
  // Call remote bundle for analysis results and emit intermediate progress
  const analysisData = await pollAnalysis(baseURL, sessionToken, bundleId, includeLint, severity);

  if (analysisData.type === 'error') {
    throw analysisData.error;
  } else if (analysisData.value.status === AnalysisStatus.failed) {
    throw new Error('Analysis has failed');
  }

  const { analysisResults } = analysisData.value;

  const filesPositions = Object.fromEntries(
    Object.entries(analysisResults.files).map(([path, positions]) => {
      const filePath = resolveBundleFilePath(baseDir, path);
      return [filePath, positions];
    }),
  );

  // Create bundle instance to handle extensions
  return {
    bundleId,
    analysisResults: {
      files: filesPositions,
      suggestions: analysisResults.suggestions,
    },
    analysisURL: analysisData.value.analysisURL,
  };
}

export async function analyzeFolders(
  baseURL = defaultBaseURL,
  sessionToken = '',
  includeLint = false,
  severity = AnalysisSeverity.info,
  paths: string[],
  symlinksEnabled = false,
  maxPayload = MAX_PAYLOAD,
  defaultFileIgnores = IGNORES_DEFAULT,
): Promise<IFileBundle> {
  // Get supported filters and test baseURL for correctness and availability
  emitter.supportedFilesLoaded(null);
  const resp = await getFilters(baseURL);
  if (resp.type === 'error') {
    throw resp.error;
  }
  const supportedFiles = resp.value;
  emitter.supportedFilesLoaded(supportedFiles);

  // Scan directories and find all suitable files
  const baseDir = determineBaseDir(paths);

  // Scan for custom ignore rules
  const fileIgnores = await collectIgnoreRules(paths, symlinksEnabled, defaultFileIgnores);

  emitter.scanFilesProgress(0);
  const bundleFiles = [];
  let totalFiles = 0;
  const bundleFileCollector = collectBundleFiles(
    baseDir,
    paths,
    supportedFiles,
    fileIgnores,
    maxPayload,
    symlinksEnabled,
  );
  for await (const f of bundleFileCollector) {
    bundleFiles.push(f);
    totalFiles += 1;
    emitter.scanFilesProgress(totalFiles);
  }

  // Create remote bundle
  const bundleResponse = await prepareRemoteBundle(baseURL, sessionToken, bundleFiles, [], null, maxPayload);
  if (bundleResponse === null) {
    throw new Error('File list is empty');
  } else if (bundleResponse.type === 'error') {
    throw bundleResponse.error;
  }

  const remoteBundle = await fullfillRemoteBundle(baseURL, sessionToken, baseDir, bundleResponse.value, maxPayload);
  if (remoteBundle.missingFiles.length) {
    throw new Error(`Failed to upload files --> ${JSON.stringify(remoteBundle.missingFiles)}`.slice(0, 399));
  }

  const analysisData = await analyzeBundle(
    baseURL,
    sessionToken,
    includeLint,
    severity,
    bundleResponse.value.bundleId,
    baseDir,
  );

  // Create bundle instance to handle extensions
  return {
    baseURL,
    sessionToken,
    includeLint,
    severity,
    supportedFiles,
    baseDir,
    paths,
    fileIgnores,
    symlinksEnabled,
    ...analysisData,
  };
}

export async function extendAnalysis(
  bundle: IFileBundle,
  filePaths: string[],
  maxPayload = MAX_PAYLOAD,
): Promise<IFileBundle | null> {
  const { files, removedFiles } = await prepareExtendingBundle(
    bundle.baseDir,
    filePaths,
    bundle.supportedFiles,
    bundle.fileIgnores,
    maxPayload,
    bundle.symlinksEnabled,
  );

  if (!files.length && !removedFiles.length) {
    return null; // nothing to extend, just return previous bundle
  }

  // Extend remote bundle
  const bundleResponse = await prepareRemoteBundle(
    bundle.baseURL,
    bundle.sessionToken,
    files,
    removedFiles,
    bundle.bundleId,
    maxPayload,
  );

  if (bundleResponse === null) {
    throw new Error('File list is empty');
  } else if (bundleResponse.type === 'error') {
    throw bundleResponse.error;
  }

  const remoteBundle = await fullfillRemoteBundle(
    bundle.baseURL,
    bundle.sessionToken,
    bundle.baseDir,
    bundleResponse.value,
    maxPayload,
  );
  if (remoteBundle.missingFiles.length) {
    throw new Error(`Failed to upload files --> ${JSON.stringify(remoteBundle.missingFiles)}`.slice(0, 399));
  }

  const analysisData = await analyzeBundle(
    bundle.baseURL,
    bundle.sessionToken,
    bundle.includeLint,
    bundle.severity,
    bundleResponse.value.bundleId,
    bundle.baseDir,
  );

  // Create bundle instance to handle extensions
  return {
    ...bundle,
    ...analysisData,
  };
}

export async function analyzeGit(
  baseURL = defaultBaseURL,
  sessionToken = '',
  includeLint = false,
  severity = AnalysisSeverity.info,
  gitUri: string,
): Promise<IGitBundle> {
  const repoKey = parseGitUri(gitUri);
  if (!repoKey) {
    throw new Error('Failed to parse git uri');
  }

  const bundleResponse = await createGitBundle({ baseURL, sessionToken, ...repoKey });
  if (bundleResponse.type === 'error') {
    throw bundleResponse.error;
  }
  const { bundleId } = bundleResponse.value;

  const analysisData = await analyzeBundle(baseURL, sessionToken, includeLint, severity, bundleId);

  // Create bundle instance to handle extensions
  return {
    baseURL,
    sessionToken,
    includeLint,
    severity,
    gitUri,
    ...analysisData,
  };
}
