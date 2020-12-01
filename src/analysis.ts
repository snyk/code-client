/* eslint-disable no-await-in-loop */

import {
  collectIgnoreRules,
  collectBundleFiles,
  prepareExtendingBundle,
  determineBaseDir,
  resolveBundleFilePath,
} from './files';
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
import { remoteBundleFactory } from './bundles';
import getSarif from './sarif_converter';
import {
  AnalysisSeverity,
  IGitBundle,
  IAnalysisFiles,
  IFileBundle,
  IBundleResult,
} from './interfaces/analysis-result.interface';

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

async function pollAnalysis({
  baseURL,
  sessionToken,
  includeLint,
  severity,
  bundleId,
  oAuthToken,
}: {
  baseURL: string;
  sessionToken: string;
  includeLint: boolean;
  severity: AnalysisSeverity;
  bundleId: string;
  oAuthToken?: string;
}): Promise<IResult<AnalysisFailedResponse | AnalysisFinishedResponse, GetAnalysisErrorCodes>> {
  let analysisResponse: IResult<GetAnalysisResponseDto, GetAnalysisErrorCodes>;
  let analysisData: GetAnalysisResponseDto;

  emitter.analyseProgress({
    status: AnalysisStatus.waiting,
    progress: 0,
  });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    analysisResponse = await getAnalysis({
      baseURL,
      sessionToken,
      oAuthToken,
      bundleId,
      includeLint,
      severity,
    });

    if (analysisResponse.type === 'error') {
      return analysisResponse;
    }

    analysisData = analysisResponse.value;

    if (
      analysisData.status === AnalysisStatus.waiting ||
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

    await sleep(500);
  }
}

export async function analyzeBundle({
  baseURL = defaultBaseURL,
  sessionToken = '',
  includeLint = false,
  severity = AnalysisSeverity.info,
  bundleId,
  oAuthToken,
}: {
  baseURL: string;
  sessionToken: string;
  includeLint: boolean;
  severity: AnalysisSeverity;
  bundleId: string;
  oAuthToken?: string;
}): Promise<IBundleResult> {
  // Call remote bundle for analysis results and emit intermediate progress
  const analysisData = await pollAnalysis({ baseURL, sessionToken, oAuthToken, bundleId, includeLint, severity });

  if (analysisData.type === 'error') {
    throw analysisData.error;
  } else if (analysisData.value.status === AnalysisStatus.failed) {
    throw new Error('Analysis has failed');
  }

  const { analysisResults } = analysisData.value;

  // Create bundle instance to handle extensions
  return {
    bundleId,
    analysisResults,
    analysisURL: analysisData.value.analysisURL,
  };
}

function normalizeResultFiles(files: IAnalysisFiles, baseDir: string) {
  if (baseDir) {
    return Object.fromEntries(
      Object.entries(files).map(([path, positions]) => {
        const filePath = resolveBundleFilePath(baseDir, path);
        return [filePath, positions];
      }),
    );
  }
  return files;
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
  const remoteBundle = await remoteBundleFactory(baseURL, sessionToken, bundleFiles, [], baseDir, null, maxPayload);
  if (remoteBundle === null) {
    throw new Error('File list is empty');
  }

  const analysisData = await analyzeBundle({
    baseURL,
    sessionToken,
    includeLint,
    severity,
    bundleId: remoteBundle.bundleId,
  });
  analysisData.analysisResults.files = normalizeResultFiles(analysisData.analysisResults.files, baseDir);

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
    return null; // nothing to extend, just return null
  }

  // Extend remote bundle
  const remoteBundle = await remoteBundleFactory(
    bundle.baseURL,
    bundle.sessionToken,
    files,
    removedFiles,
    bundle.baseDir,
    bundle.bundleId,
    maxPayload,
  );

  if (remoteBundle === null) {
    // File list is empty
    // nothing to extend, just return null
    return null;
  }

  const analysisData = await analyzeBundle({
    baseURL: bundle.baseURL,
    sessionToken: bundle.sessionToken,
    includeLint: bundle.includeLint,
    severity: bundle.severity,
    bundleId: remoteBundle.bundleId,
  });
  analysisData.analysisResults.files = normalizeResultFiles(analysisData.analysisResults.files, bundle.baseDir);

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
  sarif = false,
  oAuthToken?: string,
): Promise<IGitBundle> {
  const bundleResponse = await createGitBundle({ baseURL, sessionToken, oAuthToken, gitUri });
  if (bundleResponse.type === 'error') {
    throw bundleResponse.error;
  }
  const { bundleId } = bundleResponse.value;

  const analysisData = await analyzeBundle({ baseURL, sessionToken, oAuthToken, includeLint, severity, bundleId });

  const result = {
    baseURL,
    sessionToken,
    oAuthToken,
    includeLint,
    severity,
    gitUri,
    ...analysisData,
  };

  // Create bundle instance to handle extensions
  if (sarif && analysisData.analysisResults) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    result.sarifResults = getSarif(analysisData.analysisResults);
  }

  return result;
}
