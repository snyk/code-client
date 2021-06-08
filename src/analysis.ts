/* eslint-disable no-await-in-loop */
// import omit from 'lodash.omit';

import {
  collectIgnoreRules,
  collectBundleFiles,
  prepareExtendingBundle,
  determineBaseDir,
  resolveBundleFilePath,
} from './files';
import {
  getFilters,
  GetAnalysisErrorCodes,
  getAnalysis,
  AnalysisStatus,
  Result,
  GetAnalysisResponseDto,
  AnalysisFailedResponse,
  RemoteBundle,
} from './http';

import emitter from './emitter';
import { defaultBaseURL, MAX_PAYLOAD, IGNORES_DEFAULT } from './constants';
import { remoteBundleFactory } from './bundles';
import { AnalysisResult } from './interfaces/analysis-result.interface';
import { AnalysisSeverity, FolderOptions, AnalyzeFoldersOptions } from './interfaces/analysis-options.interface';

import { fromEntries } from './lib/utils';
import { SupportedFiles } from './interfaces/files.interface';

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

const ANALYSIS_OPTIONS_DEFAULTS = {
  baseURL: defaultBaseURL,
  sessionToken: '',
  severity: AnalysisSeverity.info,
  symlinksEnabled: false,
  maxPayload: MAX_PAYLOAD,
  defaultFileIgnores: IGNORES_DEFAULT,
  source: '',
};

export interface AnalysisOptions {
  baseURL: string;
  sessionToken: string;
  bundleHash: string;
  severity: AnalysisSeverity;
  limitToFiles?: string[];
  source: string;
}

// interface FileBundle {
//   bundleHash: string;
//   options: AnalysisOptions;
//   fileOptions: AnalyzeFoldersOptions;
//   results: AnalysisResult;
// }

async function pollAnalysis(
  options: AnalysisOptions,
): Promise<Result<AnalysisFailedResponse | AnalysisResult, GetAnalysisErrorCodes>> {
  let analysisResponse: Result<GetAnalysisResponseDto, GetAnalysisErrorCodes>;
  let analysisData: GetAnalysisResponseDto;

  emitter.analyseProgress({
    status: AnalysisStatus.waiting,
    progress: 0,
  });

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    analysisResponse = await getAnalysis(options);

    if (analysisResponse.type === 'error') {
      return analysisResponse;
    }

    analysisData = analysisResponse.value;

    if (
      analysisData.status === AnalysisStatus.waiting ||
      analysisData.status === AnalysisStatus.fetching ||
      analysisData.status === AnalysisStatus.analyzing ||
      analysisData.status === AnalysisStatus.done
    ) {
      // Report progress of fetching
      emitter.analyseProgress(analysisData);
    } else if (analysisData.status === AnalysisStatus.complete) {
      // Return data of analysis
      return analysisResponse as Result<AnalysisResult, GetAnalysisErrorCodes>;
      // deepcode ignore DuplicateIfBody: false positive it seems that interface is not taken into account
    } else if (analysisData.status === AnalysisStatus.failed) {
      // Report failure of analysing
      return analysisResponse as Result<AnalysisFailedResponse, GetAnalysisErrorCodes>;
    }

    await sleep(500);
  }
}

export async function analyzeBundle(options: AnalysisOptions): Promise<AnalysisResult> {
  // Call remote bundle for analysis results and emit intermediate progress
  const analysisData = await pollAnalysis(options);

  if (analysisData.type === 'error') {
    throw analysisData.error;
  } else if (analysisData.value.status === AnalysisStatus.failed) {
    throw new Error('Analysis has failed');
  }

  return analysisData.value;

  // // Create bundle instance to handle extensions
  // return {
  //   bundleHash,
  //   analysisResults,
  // };
}

// function normalizeResultFiles(files: AnalysisFiles, baseDir: string): AnalysisFiles {
//   if (baseDir) {
//     return fromEntries(
//       Object.entries(files).map(([path, positions]) => {
//         const filePath = resolveBundleFilePath(baseDir, path);
//         return [filePath, positions];
//       }),
//     );
//   }
//   return files;
// }

// const moveSuggestionIndexes = <T>(
//   suggestionIndex: number,
//   suggestions: { [index: string]: T },
// ): { [index: string]: T } => {
//   const entries = Object.entries(suggestions);
//   return fromEntries(
//     entries.map(([i, s]) => {
//       return [`${parseInt(i, 10) + suggestionIndex + 1}`, s];
//     }),
//   );
// };

// function mergeBundleResults(bundle: FileBundle, analysisData: IBundleResult, limitToFiles: string[]): FileBundle {
//   // Determine max suggestion index in our data
//   const suggestionIndex = Math.max(...Object.keys(bundle.analysisResults.suggestions).map(i => parseInt(i, 10))) || -1;

//   // Addup all new suggestions' indexes
//   const newSuggestions = moveSuggestionIndexes<Suggestion>(suggestionIndex, analysisData.analysisResults.suggestions);
//   const suggestions = { ...bundle.analysisResults.suggestions, ...newSuggestions };

//   const newFiles = fromEntries(
//     Object.entries(analysisData.analysisResults.files).map(([fn, s]) => {
//       return [fn, moveSuggestionIndexes(suggestionIndex, s)];
//     }),
//   );
//   const files = {
//     ...omit(bundle.analysisResults.files, limitToFiles),
//     ...newFiles,
//   };

//   const analysisResults = {
//     ...analysisData.analysisResults,
//     files,
//     suggestions,
//   };

//   return {
//     ...bundle,
//     ...analysisData,
//     analysisResults,
//   };
// }

export async function analyzeFolders(options: FolderOptions): Promise<FileBundle> {
  const analysisOptions: AnalyzeFoldersOptions = { ...ANALYSIS_OPTIONS_DEFAULTS, ...options };
  const { baseURL, sessionToken, severity, paths, symlinksEnabled, defaultFileIgnores, source } = analysisOptions;

  const supportedFiles = await getSupportedFiles(baseURL, source);

  // Scan directories and find all suitable files
  const baseDir = determineBaseDir(paths);

  // Scan for custom ignore rules
  const fileIgnores = await collectIgnoreRules(paths, symlinksEnabled, defaultFileIgnores);

  const remoteBundle = await createBundleFromFolders({ ...analysisOptions, supportedFiles, baseDir, fileIgnores });

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
      bundleHash: '',
    };
  } else {
    analysisData = await analyzeBundle({
      baseURL,
      sessionToken,
      severity,
      bundleHash: remoteBundle.bundleHash,
      source,
    });
    analysisData.analysisResults.files = normalizeResultFiles(analysisData.analysisResults.files, baseDir);
  }

  const result = {
    baseURL,
    sessionToken,
    severity,
    supportedFiles,
    baseDir,
    paths,
    fileIgnores,
    symlinksEnabled,
    ...analysisData,
  };

  return result;
}

export async function extendAnalysis(
  bundle: FileBundle,
  filePaths: string[],
  maxPayload = MAX_PAYLOAD,
  source: string,
): Promise<FileBundle | null> {
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
    bundle.bundleHash,
    maxPayload,
    source,
  );

  if (remoteBundle === null) {
    // File list is empty
    // nothing to extend, just return null
    return null;
  }

  const analysisData = await analyzeBundle({
    baseURL: bundle.baseURL,
    sessionToken: bundle.sessionToken,
    severity: bundle.severity,
    bundleHash: remoteBundle.bundleHash,
    limitToFiles: files.map(f => f.bundlePath),
    source,
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

interface CreateBundleFromFoldersOptions extends FolderOptions {
  supportedFiles?: SupportedFiles;
  baseDir?: string;
  fileIgnores?: string[];
}

/**
 * Creates a remote bundle and returns response from the bundle API
 *
 * @param {CreateBundleFromFoldersOptions} options
 * @returns {Promise<RemoteBundle | null>}
 */
export async function createBundleFromFolders(options: CreateBundleFromFoldersOptions): Promise<RemoteBundle | null> {
  const analysisOptions = { ...ANALYSIS_OPTIONS_DEFAULTS, ...options };

  const {
    baseURL,
    source,
    paths,
    symlinksEnabled,
    defaultFileIgnores,
    maxPayload,
    sessionToken,
    supportedFiles = await getSupportedFiles(baseURL, source),
    baseDir = determineBaseDir(paths),
    fileIgnores = await collectIgnoreRules(paths, symlinksEnabled, defaultFileIgnores),
  } = analysisOptions;

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
  return bundleFiles.length
    ? remoteBundleFactory(baseURL, sessionToken, bundleFiles, [], baseDir, null, maxPayload, source)
    : null;
}

/**
 * Get supported filters and test baseURL for correctness and availability
 *
 * @param baseURL
 * @param source
 * @returns
 */
async function getSupportedFiles(baseURL: string, source: string): Promise<SupportedFiles> {
  emitter.supportedFilesLoaded(null);
  const resp = await getFilters(baseURL, source);
  if (resp.type === 'error') {
    throw resp.error;
  }
  const supportedFiles = resp.value;
  emitter.supportedFilesLoaded(supportedFiles);
  return supportedFiles;
}
