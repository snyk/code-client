/* eslint-disable no-await-in-loop */
import { omit } from 'lodash';

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
  getDiffAnalysis,
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
  ISuggestion,
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
  username,
  limitToFiles,
  newBundleId,
}: {
  baseURL: string;
  sessionToken: string;
  includeLint: boolean;
  severity: AnalysisSeverity;
  bundleId: string;
  oAuthToken?: string;
  username?: string;
  limitToFiles?: string[];
  newBundleId?: string;
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
    analysisResponse = newBundleId
      ? await getDiffAnalysis({
          baseURL,
          sessionToken,
          oAuthToken,
          username,
          oldBundleId: bundleId,
          newBundleId,
          includeLint,
          severity,
          limitToFiles,
        })
      : await getAnalysis({
          baseURL,
          sessionToken,
          oAuthToken,
          username,
          bundleId,
          includeLint,
          severity,
          limitToFiles,
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
  username,
  limitToFiles,
}: {
  baseURL: string;
  sessionToken: string;
  includeLint: boolean;
  severity: AnalysisSeverity;
  bundleId: string;
  oAuthToken?: string;
  username?: string;
  limitToFiles?: string[];
}): Promise<IBundleResult> {
  // Call remote bundle for analysis results and emit intermediate progress
  const analysisData = await pollAnalysis({
    baseURL,
    sessionToken,
    oAuthToken,
    username,
    bundleId,
    includeLint,
    severity,
    limitToFiles,
  });

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

export async function analyzeBundles({
  baseURL = defaultBaseURL,
  sessionToken = '',
  includeLint = false,
  severity = AnalysisSeverity.info,
  oldBundleId,
  newBundleId,
  oAuthToken,
  username,
  limitToFiles,
}: {
  baseURL: string;
  sessionToken: string;
  includeLint: boolean;
  severity: AnalysisSeverity;
  oldBundleId: string;
  newBundleId: string;
  oAuthToken?: string;
  username?: string;
  limitToFiles?: string[];
}): Promise<IBundleResult> {
  // Call remote bundle for analysis results and emit intermediate progress
  const analysisData = await pollAnalysis({
    baseURL,
    sessionToken,
    oAuthToken,
    username,
    bundleId: oldBundleId,
    includeLint,
    severity,
    limitToFiles,
    newBundleId,
  });

  if (analysisData.type === 'error') {
    throw analysisData.error;
  } else if (analysisData.value.status === AnalysisStatus.failed) {
    throw new Error('Analysis has failed');
  }

  const { analysisResults } = analysisData.value;

  // Create bundle instance to handle extensions
  return {
    bundleId: oldBundleId,
    analysisResults,
    analysisURL: analysisData.value.analysisURL,
  };
}
function normalizeResultFiles(files: IAnalysisFiles, baseDir: string): IAnalysisFiles {
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

const moveSuggestionIndexes = <T>(
  suggestionIndex: number,
  suggestions: { [index: string]: T },
): { [index: string]: T } => {
  const entries = Object.entries(suggestions);
  return Object.fromEntries(
    entries.map(([i, s]) => {
      return [`${parseInt(i, 10) + suggestionIndex + 1}`, s];
    }),
  );
};

function mergeBundleResults(bundle: IFileBundle, analysisData: IBundleResult, limitToFiles: string[]): IFileBundle {
  // Determine max suggestion index in our data
  const suggestionIndex = Math.max(...Object.keys(bundle.analysisResults.suggestions).map(i => parseInt(i, 10))) || -1;

  // Addup all new suggestions' indexes
  const newSuggestions = moveSuggestionIndexes<ISuggestion>(suggestionIndex, analysisData.analysisResults.suggestions);
  const suggestions = { ...bundle.analysisResults.suggestions, ...newSuggestions };

  const newFiles = Object.fromEntries(
    Object.entries(analysisData.analysisResults.files).map(([fn, s]) => {
      return [fn, moveSuggestionIndexes(suggestionIndex, s)];
    }),
  );
  const files = {
    ...omit(bundle.analysisResults.files, limitToFiles),
    ...newFiles,
  };

  const analysisResults = {
    ...analysisData.analysisResults,
    files,
    suggestions,
  };

  return {
    ...bundle,
    ...analysisData,
    analysisResults,
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
  const remoteBundle = bundleFiles.length
    ? await remoteBundleFactory(baseURL, sessionToken, bundleFiles, [], baseDir, null, maxPayload)
    : null;

  // Analyze bundle
  let analysisData;
  if (remoteBundle === null) {
    analysisData = {
      analysisResults: {
        files: {},
        suggestions: {},
        timing: {
          analysis: 0,
          fetchingCode: 0,
          queue: 0,
        },
        coverage: [],
      },
      analysisURL: '',
      bundleId: '',
    };
  } else {
    analysisData = await analyzeBundle({
      baseURL,
      sessionToken,
      includeLint,
      severity,
      bundleId: remoteBundle.bundleId,
    });
    analysisData.analysisResults.files = normalizeResultFiles(analysisData.analysisResults.files, baseDir);
  }

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
    limitToFiles: files.map(f => f.bundlePath),
  });
  // Transform relative paths into absolute
  analysisData.analysisResults.files = normalizeResultFiles(analysisData.analysisResults.files, bundle.baseDir);

  // Merge into base bundle results
  return mergeBundleResults(
    bundle,
    analysisData,
    files.map(f => f.filePath),
  );
}

export async function analyzeGit(
  baseURL = defaultBaseURL,
  sessionToken = '',
  includeLint = false,
  severity = AnalysisSeverity.info,
  gitUri: string,
  sarif = false,
  oAuthToken?: string,
  username?: string,
): Promise<IGitBundle> {
  const bundleResponse = await createGitBundle({ baseURL, sessionToken, oAuthToken, username, gitUri });
  if (bundleResponse.type === 'error') {
    throw bundleResponse.error;
  }
  const { bundleId } = bundleResponse.value;

  const analysisData = await analyzeBundle({
    baseURL,
    sessionToken,
    oAuthToken,
    username,
    includeLint,
    severity,
    bundleId,
  });

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

export async function analyzeGitDiff(
  baseURL = defaultBaseURL,
  sessionToken = '',
  includeLint = false,
  severity = AnalysisSeverity.info,
  gitUriOld: string,
  gitUriNew: string,
  sarif = false,
  oAuthToken?: string,
  username?: string,
): Promise<IGitBundle> {
  const bundleResponseOld = await createGitBundle({ baseURL, sessionToken, oAuthToken, username, gitUri: gitUriOld });
  const bundleResponseNew = await createGitBundle({ baseURL, sessionToken, oAuthToken, username, gitUri: gitUriNew });
  if (bundleResponseOld.type === 'error') {
    throw bundleResponseOld.error;
  }
  if (bundleResponseNew.type === 'error') {
    throw bundleResponseNew.error;
  }
  const { bundleId: oldBundleId } = bundleResponseOld.value;
  const { bundleId: newBundleId } = bundleResponseNew.value;

  const analysisData = await analyzeBundles({
    baseURL,
    sessionToken,
    oAuthToken,
    username,
    includeLint,
    severity,
    oldBundleId,
    newBundleId,
  });

  const result = {
    baseURL,
    sessionToken,
    oAuthToken,
    includeLint,
    severity,
    gitUri: gitUriOld,
    ...analysisData,
  };

  // Create bundle instance to handle extensions
  if (sarif && analysisData.analysisResults) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    result.sarifResults = getSarif(analysisData.analysisResults);
  }

  return result;
}
