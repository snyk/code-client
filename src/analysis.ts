/* eslint-disable no-await-in-loop */
// import omit from 'lodash.omit';

import {
  collectIgnoreRules,
  collectBundleFiles,
  prepareExtendingBundle,
  determineBaseDir,
  resolveBundleFilePath,
  AnalyzeFoldersOptions,
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
  GetAnalysisOptions,
} from './http';

import emitter from './emitter';
import { MAX_PAYLOAD } from './constants';
import { remoteBundleFactory } from './bundles';
import { AnalysisResult } from './interfaces/analysis-result.interface';

import { fromEntries } from './lib/utils';
import { SupportedFiles } from './interfaces/files.interface';
import pick from 'lodash.pick';

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

// const ANALYSIS_OPTIONS_DEFAULTS = {
//   baseURL: defaultBaseURL,
//   sessionToken: '',
//   severity: AnalysisSeverity.info,
//   symlinksEnabled: false,
//   maxPayload: MAX_PAYLOAD,
//   defaultFileIgnores: IGNORES_DEFAULT,
//   source: '',
// };


async function pollAnalysis(
  options: GetAnalysisOptions,
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

export async function analyzeBundle(options: GetAnalysisOptions): Promise<AnalysisResult> {
  // Call remote bundle for analysis results and emit intermediate progress
  const analysisData = await pollAnalysis(options);

  if (analysisData.type === 'error') {
    throw analysisData.error;
  } else if (analysisData.value.status === AnalysisStatus.failed) {
    throw new Error('Analysis has failed');
  }

  return analysisData.value;
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

interface FileBundle {
  options: GetAnalysisOptions;
  fileOptions: AnalyzeFoldersOptions;
  results: AnalysisResult;
}

export async function analyzeFolders(
  options: GetAnalysisOptions,
  fileOptions: AnalyzeFoldersOptions,
): Promise<AnalysisResult | null> {
  const supportedFiles = await getSupportedFiles(options.baseURL, options.source);

  // Scan directories and find all suitable files
  const baseDir = determineBaseDir(fileOptions.paths);

  // Scan for custom ignore rules
  const fileIgnores = await collectIgnoreRules(
    fileOptions.paths,
    fileOptions.symlinksEnabled,
    fileOptions.defaultFileIgnores,
  );

  const remoteBundle = await createBundleFromFolders({
    ...options,
    fileOptions,
    supportedFiles,
    baseDir,
    fileIgnores,
  });

  // Analyze bundle
  if (remoteBundle === null) {
    return null;
  }

  const analysisResults = await analyzeBundle({ ...options, bundleHash: remoteBundle.bundleHash });
  // TODO: expand relative file names to absolute ones
  // analysisResults.files = normalizeResultFiles(analysisData.analysisResults.files, baseDir);
  return analysisResults;
}

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

interface ExtendAnalysisOptions extends GetAnalysisOptions {
  fileOptions: AnalyzeFoldersOptions;
  bundle: FileBundle;
  supportedFiles: SupportedFiles;
  baseDir: string;
  fileIgnores: string[];
}

export async function extendAnalysis(options: ExtendAnalysisOptions): Promise<FileBundle | null> {
  const { files, removedFiles } = await prepareExtendingBundle(
    options.baseDir,
    options.supportedFiles,
    options.fileIgnores,
    options.fileOptions.paths,
    options.fileOptions.maxPayload,
    options.fileOptions.symlinksEnabled,
  );

  if (!files.length && !removedFiles.length) {
    return null; // nothing to extend, just return null
  }

  // Extend remote bundle
  const remoteBundle = await remoteBundleFactory({
    ...pick(options, ['baseURL', 'sessionToken', 'source']),
    bundleHash: options.bundleHash,
    baseDir: options.baseDir,
    maxPayload: options.fileOptions.maxPayload,
    files,
    removedFiles,
  });

  if (remoteBundle === null) {
    // File list is empty
    // nothing to extend, just return null
    return null;
  }

  const analysisResults = await analyzeBundle({
    ...pick(options, ['baseURL', 'sessionToken', 'source']),
    severity: options.severity,
    bundleHash: remoteBundle.bundleHash,
    limitToFiles: files.map(f => f.bundlePath),
  });

  // TODO: Transform relative paths into absolute
  // analysisData.analysisResults.files = normalizeResultFiles(analysisData.analysisResults.files, bundle.baseDir);

  // Merge into base bundle results
  return mergeBundleResults(
    bundle,
    analysisData,
    files.map(f => f.filePath),
  );
}

interface CreateBundleFromFoldersOptions extends GetAnalysisOptions {
  fileOptions: AnalyzeFoldersOptions;
  supportedFiles: SupportedFiles;
  baseDir: string;
  fileIgnores: string[];
}

/**
 * Creates a remote bundle and returns response from the bundle API
 *
 * @param {CreateBundleFromFoldersOptions} options
 * @returns {Promise<RemoteBundle | null>}
 */
export async function createBundleFromFolders(options: CreateBundleFromFoldersOptions): Promise<RemoteBundle | null> {
  // const {
  //   supportedFiles = await getSupportedFiles(baseURL, source),
  //   baseDir = determineBaseDir(paths),
  //   fileIgnores = await collectIgnoreRules(paths, symlinksEnabled, defaultFileIgnores),
  // } = analysisOptions;

  emitter.scanFilesProgress(0);
  const bundleFiles = [];
  let totalFiles = 0;
  const bundleFileCollector = collectBundleFiles(options);
  for await (const f of bundleFileCollector) {
    bundleFiles.push(f);
    totalFiles += 1;
    emitter.scanFilesProgress(totalFiles);
  }

  // Create remote bundle
  return bundleFiles.length ? remoteBundleFactory({ ...options, files: bundleFiles }) : null;
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
