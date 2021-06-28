/* eslint-disable no-await-in-loop */
import pick from 'lodash.pick';

import { AnalyzeFoldersOptions, prepareExtendingBundle } from './files';
import {
  GetAnalysisErrorCodes,
  getAnalysis,
  AnalysisStatus,
  Result,
  GetAnalysisResponseDto,
  AnalysisFailedResponse,
  AnalysisOptions,
  ConnectionOptions,
  GetAnalysisOptions,
} from './http';
import { createBundleFromFolders, FileBundle, remoteBundleFactory } from './bundles';
import emitter from './emitter';
import { AnalysisResult } from './interfaces/analysis-result.interface';

// import { fromEntries } from './lib/utils';

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

// const ANALYSIS_OPTIONS_DEFAULTS = {
//   baseURL: defaultBaseURL,
//   sessionToken: '',
//   severity: AnalysisSeverity.info,
//   symlinksEnabled: false,
//   defaultFileIgnores: IGNORES_DEFAULT,
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

interface FileAnalysisOptions {
  connection: ConnectionOptions;
  analysisOptions: AnalysisOptions;
  fileOptions: AnalyzeFoldersOptions;
}

interface FileAnalysis extends FileAnalysisOptions {
  fileBundle: FileBundle;
  analysisResults: AnalysisResult;
}

export async function analyzeFolders(options: FileAnalysisOptions): Promise<FileAnalysis | null> {
  const fileBundle = await createBundleFromFolders({
    ...options.connection,
    ...options.fileOptions,
  });
  if (fileBundle === null) return null;

  // Analyze bundle
  const analysisResults = await analyzeBundle({
    bundleHash: fileBundle.bundleHash,
    ...options.connection,
    ...options.analysisOptions,
  });
  // TODO: expand relative file names to absolute ones
  // analysisResults.files = normalizeResultFiles(analysisData.analysisResults.files, baseDir);

  return { fileBundle, analysisResults, ...options };
}

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

interface ExtendAnalysisOptions extends FileAnalysis {
  files: string[];
}

export async function extendAnalysis(options: ExtendAnalysisOptions): Promise<FileAnalysis | null> {
  const { files, removedFiles } = await prepareExtendingBundle(
    options.fileBundle.baseDir,
    options.fileBundle.supportedFiles,
    options.fileBundle.fileIgnores,

    options.files,

    options.fileOptions.maxPayload,
    options.fileOptions.symlinksEnabled,
  );

  if (!files.length && !removedFiles.length) {
    return null; // nothing to extend, just return null
  }

  // Extend remote bundle
  const remoteBundle = await remoteBundleFactory({
    ...options.connection,

    bundleHash: options.fileBundle.bundleHash,
    baseDir: options.fileBundle.baseDir,
    maxPayload: options.fileOptions.maxPayload,

    files,
    removedFiles,
  });
  if (remoteBundle === null) return null;

  const fileBundle = {
    ...options.fileBundle,
    ...remoteBundle,
  };

  const analysisResults = await analyzeBundle({
    bundleHash: remoteBundle.bundleHash,
    ...options.connection,
    ...options.analysisOptions,
    limitToFiles: files.map(f => f.bundlePath),
  });

  // TODO: Transform relative paths into absolute
  // analysisData.analysisResults.files = normalizeResultFiles(analysisData.analysisResults.files, bundle.baseDir);

  return { ...options, fileBundle, analysisResults };

  // Merge into base bundle results
  // return mergeBundleResults(
  //   bundle,
  //   analysisData,
  //   files.map(f => f.filePath),
  // );
}
