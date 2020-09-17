import { chunk } from 'lodash';

import { collectBundleFiles, prepareBundleHashes, prepareFilePath, composeFilePayloads } from './files';
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

import { ISupportedFiles, IFileInfo } from './interfaces/files.interface';
import { AnalysisSeverity, IAnalysisResult } from './interfaces/analysis-result.interface';

// 1. Create a bundle for paths from scratch. Return bundle info together with request details and analysis results. Create a class Bundle for this
// 2. class Bundle will implement method extend, that will conduct analysis and return another Bundle instance
// 3. Create a queue, that would manage bundle extensions

async function createRemoteBundle(
  baseURL: string,
  sessionToken: string,
  fileHashes: IFileInfo[],
  maxPayload = MAX_PAYLOAD,
): Promise<IResult<RemoteBundle> | null> {
  let response: IResult<RemoteBundle> | null = null;

  const fileChunks = chunk(fileHashes, maxPayload / 300);
  emitter.createBundleProgress(0, fileChunks.length);
  for (const [i, chunkedFiles] of fileChunks.entries()) {
    const files = Object.fromEntries(chunkedFiles.map(d => [prepareFilePath(d.path), d.hash]));

    if (response === null) {
      // eslint-disable-next-line no-await-in-loop
      response = await createBundle({
        baseURL,
        sessionToken,
        files,
      });
    } else {
      // eslint-disable-next-line no-await-in-loop
      response = await extendBundle({
        baseURL,
        sessionToken,
        bundleId: response.value.bundleId,
        files,
      });
    }

    emitter.createBundleProgress(i, fileChunks.length);

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
  remoteBundle: RemoteBundle,
): Promise<boolean> {
  let uploadedFiles = 0;
  emitter.uploadBundleProgress(0, remoteBundle.missingFiles.length);

  const uploadFileChunks = async (bucketFiles: IFileInfo[]): Promise<boolean> => {
    const resp = await uploadFiles({
      baseURL,
      sessionToken,
      bundleId: remoteBundle.bundleId,
      content: bucketFiles.map(f => {
        return { fileHash: f.hash, fileContent: f.content || '' };
      }),
    });

    if (resp.type !== 'error') {
      uploadedFiles += bucketFiles.length;
      emitter.uploadBundleProgress(uploadedFiles, remoteBundle.missingFiles.length);
      return true;
    }

    return false;
  };

  const tasks = [];
  for (const bucketFiles of composeFilePayloads(remoteBundle.missingFiles)) {
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
): Promise<FileBundle> {
  // Get supported filters and test baseURL for correctness and availability
  const resp = await getFilters(baseURL);
  if (resp.type === 'error') {
    throw new Error('baseURL is incorrect or server is not reachable now');
  }
  const supportedFiles = resp.value;

  // Scan directories and find all suitable files

  emitter.scanFilesProgress(0); // TODO: report progress on scanning too
  const bundleFiles = collectBundleFiles(paths, supportedFiles);
  emitter.scanFilesProgress(bundleFiles.length); // TODO: report progress on scanning too

  // Annotate all suitable files with meta information including hashe
  const fileHashes = [];
  let filesCount = 0;
  emitter.computeHashProgress(0, bundleFiles.length);
  for (const h of prepareBundleHashes(bundleFiles, maxPayload)) {
    fileHashes.push(h);
    filesCount += 1;
    emitter.computeHashProgress(filesCount, bundleFiles.length);
  }

  // Create remote bundle
  let bundleResponse = await createRemoteBundle(baseURL, sessionToken, fileHashes, maxPayload);
  if (bundleResponse === null) {
    throw new Error('File list is empty');
  } else if (bundleResponse.type === 'error') {
    throw bundleResponse.error;
  }

  // Fulfill remove bundle by uploading only missing files (splitted in chunks)
  // Check remove bundle to make sure no missing files left
  let remoteBundle = bundleResponse.value;
  if (remoteBundle.missingFiles.length) {
    const isUploaded = await uploadRemoteBundle(baseURL, sessionToken, remoteBundle);
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

  // Create bundle instance to handle extensions
  const bundle = new FileBundle(
    baseURL,
    sessionToken,
    includeLint,
    severity,
    remoteBundle.bundleId,
    analysisData.value.analysisResults,
    analysisData.value.analysisURL,
  );

  bundle.supportedFiles = supportedFiles;
  bundle.paths = paths;
  return bundle;
}

export async function analyzeGit(
  baseURL = defaultBaseURL,
  sessionToken = '',
  includeLint = false,
  severity = AnalysisSeverity.info,
  gitUri: string,
): Promise<GitBundle> {
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
  const bundle = new GitBundle(
    baseURL,
    sessionToken,
    includeLint,
    severity,
    bundleId,
    analysisData.value.analysisResults,
    analysisData.value.analysisURL,
  );
  bundle.gitUri = gitUri;
  return bundle;
}

class BundleBase {
  private readonly baseURL: string;
  private readonly sessionToken: string;
  private readonly includeLint: boolean;
  private readonly severity: AnalysisSeverity;
  public readonly bundleId: string;
  public readonly analysisResults: IAnalysisResult;
  public readonly analysisUrl: string;

  constructor(
    baseURL: string,
    sessionToken: string,
    includeLint: boolean,
    severity: AnalysisSeverity,
    bundleId: string,
    analysisResults: IAnalysisResult,
    analysisUrl: string,
  ) {
    this.baseURL = baseURL;
    this.sessionToken = sessionToken;
    this.includeLint = includeLint;
    this.severity = severity;
    this.bundleId = bundleId;
    this.analysisResults = analysisResults;
    this.analysisUrl = analysisUrl;
  }
}

class GitBundle extends BundleBase {
  public gitUri: string;
}

class FileBundle extends BundleBase {
  public paths: string[];
  public supportedFiles: ISupportedFiles;

  // public async extend(files: string[], removedFiles: string[]): Promise<FileBundle> {
  //   return this;
  // }

  //     await startAnalysisLoop({ baseURL, sessionToken, bundleId: this.bundleId }).catch(error => {
  //       emitter.sendError(error);
  //       throw error;
  //     });
  //   } catch (error) {
  //     emitter.sendError(error);
  //     throw error;
  //   }
  // }
}
