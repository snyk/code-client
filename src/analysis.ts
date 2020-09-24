/* eslint-disable no-await-in-loop */
import { chunk } from 'lodash';

import {
  collectBundleFiles,
  composeFilePayloads,
  determineBaseDir,
  resolveBundleFiles,
  resolveBundleFilePath,
} from './files';
import parseGitUri from './gitUtils';
import {
  getFilters,
  createBundle,
  createGitBundle,
  extendBundle,
  uploadFiles,
  checkBundle,
  getAnalysis,
  AnalysisStatus,
  IResult,
  RemoteBundle,
  GetAnalysisResponseDto,
  AnalysisFailedResponse,
  AnalysisFinishedResponse,
} from './http';
import emitter from './emitter';
import { defaultBaseURL, MAX_PAYLOAD } from './constants';

import { IFileInfo } from './interfaces/files.interface';
import { AnalysisSeverity, IGitBundle, IFileBundle } from './interfaces/analysis-result.interface';

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

async function pollAnalysis(
  baseURL: string,
  sessionToken: string,
  bundleId: string,
  useLinters: boolean,
  severity: AnalysisSeverity,
): Promise<IResult<AnalysisFailedResponse | AnalysisFinishedResponse>> {
  let analysisResponse: IResult<GetAnalysisResponseDto>;
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
      return analysisResponse as IResult<AnalysisFinishedResponse>;
    } else if (analysisData.status === AnalysisStatus.failed) {
      // Report failure of analysing
      return analysisResponse as IResult<AnalysisFailedResponse>;
    }
  }
}

export async function analyzeFolders(
  baseURL = defaultBaseURL,
  sessionToken = '',
  includeLint = false,
  severity = AnalysisSeverity.info,
  paths: string[],
  maxPayload = MAX_PAYLOAD,
): Promise<IFileBundle> {
  // Get supported filters and test baseURL for correctness and availability
  emitter.supportedFilesLoaded(null);
  const resp = await getFilters(baseURL);
  if (resp.type === 'error') {
    throw new Error('baseURL is incorrect or server is not reachable now');
  }
  const supportedFiles = resp.value;
  emitter.supportedFilesLoaded(supportedFiles);

  // Scan directories and find all suitable files
  const baseDir = determineBaseDir(paths);

  emitter.scanFilesProgress(0);
  const bundleFiles = [];
  let totalFiles = 0;
  for await (const f of collectBundleFiles(baseDir, paths, supportedFiles)) {
    bundleFiles.push(f);
    totalFiles += 1;
    emitter.scanFilesProgress(totalFiles);
  }

  // Create remote bundle
  let bundleResponse = await createRemoteBundle(baseURL, sessionToken, bundleFiles, maxPayload);
  if (bundleResponse === null) {
    throw new Error('File list is empty');
  } else if (bundleResponse.type === 'error') {
    throw bundleResponse.error;
  }

  // Fulfill remove bundle by uploading only missing files (splitted in chunks)
  // Check remove bundle to make sure no missing files left
  let remoteBundle = bundleResponse.value;
  while (remoteBundle.missingFiles.length) {
    const missingFiles = await resolveBundleFiles(baseDir, remoteBundle.missingFiles);
    const isUploaded = await uploadRemoteBundle(baseURL, sessionToken, remoteBundle.bundleId, missingFiles, maxPayload);
    if (!isUploaded) {
      throw new Error('Failed to upload some files');
    }
    bundleResponse = await checkBundle({
      baseURL,
      sessionToken,
      bundleId: remoteBundle.bundleId,
    });
    if (bundleResponse.type === 'error') {
      throw new Error('Failed to get remote bundle');
    }
    remoteBundle = bundleResponse.value;
  }

  // Call remote bundle for analysis results and emit intermediate progress
  const analysisData = await pollAnalysis(baseURL, sessionToken, remoteBundle.bundleId, includeLint, severity);

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
    baseURL,
    sessionToken,
    includeLint,
    severity,
    supportedFiles,
    baseDir,
    paths,
    bundleId: remoteBundle.bundleId,
    analysisResults: {
      files: filesPositions,
      suggestions: analysisResults.suggestions,
    },
    analysisURL: analysisData.value.analysisURL,
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
    throw new Error('Failed to find last commit hash');
  }
  const { bundleId } = bundleResponse.value;

  // Call remote bundle for analysis results and emit intermediate progress
  const analysisData = await pollAnalysis(baseURL, sessionToken, bundleId, includeLint, severity);

  if (analysisData.type === 'error') {
    throw analysisData.error;
  } else if (analysisData.value.status === AnalysisStatus.failed) {
    throw new Error('Analysis has failed');
  }

  // Create bundle instance to handle extensions
  return {
    baseURL,
    sessionToken,
    includeLint,
    severity,
    bundleId,
    gitUri,
    analysisResults: analysisData.value.analysisResults,
    analysisURL: analysisData.value.analysisURL,
  };
}

// public async extend(files: string[], removedFiles: string[]): Promise<IFileBundle> {
//   return this;
// }
