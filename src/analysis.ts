/* eslint-disable no-await-in-loop */
import omit from 'lodash.omit';
import { v4 as uuidv4 } from 'uuid';

import { prepareExtendingBundle, resolveBundleFilePath, calcHash } from './files';
import { POLLING_INTERVAL } from './constants';
import {
  GetAnalysisErrorCodes,
  getAnalysis,
  AnalysisStatus,
  Result,
  GetAnalysisResponseDto,
  AnalysisFailedResponse,
  GetAnalysisOptions,
  ConnectionOptions,
} from './http';
import { createBundleFromFolders, remoteBundleFactory } from './bundles';
import { reportBundle, reportScm } from './report';
import { emitter } from './emitter';
import {
  AnalysisResult,
  AnalysisResultLegacy,
  AnalysisResultSarif,
  AnalysisFiles,
  Suggestion,
  ReportUploadResult,
  ScmAnalysis,
} from './interfaces/analysis-result.interface';
import { AnalysisContext, FileAnalysisOptions, ScmAnalysisOptions } from './interfaces/analysis-options.interface';
import { FileAnalysis } from './interfaces/files.interface';

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

function getConnectionOptions(connectionOptions: ConnectionOptions): ConnectionOptions {
  return {
    ...connectionOptions,
    // Ensure requestId is set.
    requestId: connectionOptions.requestId ?? uuidv4(),
  };
}

function getAnalysisContext(
  analysisContext: AnalysisContext['analysisContext'] | undefined,
): AnalysisContext | Record<string, never> {
  return analysisContext ? { analysisContext } : {};
}

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

    await sleep(POLLING_INTERVAL);
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

function normalizeResultFiles(files: AnalysisFiles, baseDir: string): AnalysisFiles {
  return Object.entries(files).reduce((obj, [path, positions]) => {
    const filePath = resolveBundleFilePath(baseDir, path);
    obj[filePath] = positions;
    return obj;
  }, {});
}

/**
 * Perform a file-based analysis.
 * Optionally with reporting of results to the platform.
 */
export async function analyzeFolders(options: FileAnalysisOptions): Promise<FileAnalysis | null> {
  const connectionOptions = getConnectionOptions(options.connection);
  const analysisContext = getAnalysisContext(options.analysisContext);

  const fileBundle = await createBundleFromFolders({
    ...connectionOptions,
    ...options.fileOptions,
    languages: options.languages,
  });
  if (fileBundle === null) return null;

  const config = {
    bundleHash: fileBundle.bundleHash,
    ...connectionOptions,
    ...options.analysisOptions,
    shard: calcHash(fileBundle.baseDir),
    ...analysisContext,
  };

  let analysisResults: AnalysisResult;

  // Whether this is a report/result upload operation.
  const isReport = options.reportOptions?.enabled ?? false;
  let reportResults: ReportUploadResult | undefined;
  if (isReport && options.reportOptions) {
    // Analyze and upload bundle results.
    const reportRes = await reportBundle({
      ...config,
      report: options.reportOptions,
    });
    analysisResults = reportRes.analysisResult;
    reportResults = reportRes.uploadResult;
  } else {
    // Analyze bundle.
    analysisResults = await analyzeBundle(config);
  }

  if (analysisResults.type === 'legacy') {
    // expand relative file names to absolute ones only for legacy results
    analysisResults.files = normalizeResultFiles(analysisResults.files, fileBundle.baseDir);
  }

  return { fileBundle, analysisResults, reportResults, ...options };
}

function mergeBundleResults(
  oldAnalysisResults: AnalysisResult,
  newAnalysisResults: AnalysisResult,
  limitToFiles: string[],
  removedFiles: string[] = [],
  baseDir: string,
): AnalysisResult {
  if (newAnalysisResults.type == 'sarif') {
    return mergeSarifResults(oldAnalysisResults as AnalysisResultSarif, newAnalysisResults, limitToFiles, removedFiles);
  }

  return mergeLegacyResults(
    oldAnalysisResults as AnalysisResultLegacy,
    newAnalysisResults,
    limitToFiles,
    removedFiles,
    baseDir,
  );
}

function mergeSarifResults(
  oldAnalysisResults: AnalysisResultSarif,
  newAnalysisResults: AnalysisResultSarif,
  limitToFiles: string[],
  removedFiles: string[] = [],
): AnalysisResultSarif {
  // Start from the new analysis results
  // For each finding of the old analysis,
  //  if it's location is not part of the limitToFiles or removedFiles (removedFiles should also be checked against condeFlow),
  //   append the finding to the new analysis and check if the rule must be added as well
  const changedFiles = [...limitToFiles, ...removedFiles];
  const sarifResults = (newAnalysisResults.sarif.runs[0].results || []).filter(res => {
    // TODO: This should not be necessary in theory but, in case of two identical files,
    // Bundle Server returns the finding in both files even if limitToFiles only reports one
    const loc = res.locations?.[0].physicalLocation?.artifactLocation?.uri;
    return loc && changedFiles.includes(loc);
  });
  const sarifRules = newAnalysisResults.sarif.runs[0].tool.driver.rules || [];
  const oldResults = oldAnalysisResults.sarif.runs[0].results || [];
  for (const res of oldResults) {
    // NOTE: Node 10 doesn't support the more readable .flatMap, so we need to use .reduce, but the behaviour would be the following:
    // const locations: string[] = (res.locations || []).flatMap(
    //   loc => !!loc.physicalLocation?.artifactLocation?.uri ? [loc.physicalLocation.artifactLocation.uri] : []
    // );
    // const codeFlowLocations: string[] = (res.codeFlows || []).flatMap(
    //   cf => (cf.threadFlows || []).flatMap(
    //     tf => (tf.locations || []).flatMap(
    //       loc => !!loc.location?.physicalLocation?.artifactLocation?.uri ? [loc.location.physicalLocation.artifactLocation.uri] : []
    //     )
    //   )
    // );
    const locations: string[] = (res.locations || []).reduce<string[]>((acc, loc) => {
      if (loc.physicalLocation?.artifactLocation?.uri) {
        acc.push(loc.physicalLocation.artifactLocation.uri);
      }
      return acc;
    }, []);
    const codeFlowLocations: string[] = (res.codeFlows || []).reduce<string[]>((acc1, cf) => {
      acc1.push(
        ...(cf.threadFlows || []).reduce<string[]>((acc2, tf) => {
          acc2.push(
            ...(tf.locations || []).reduce<string[]>((acc3, loc) => {
              if (loc.location?.physicalLocation?.artifactLocation?.uri) {
                acc3.push(loc.location.physicalLocation.artifactLocation.uri);
              }
              return acc3;
            }, []),
          );
          return acc2;
        }, []),
      );
      return acc1;
    }, []);
    if (locations.some(loc => changedFiles.includes(loc)) || codeFlowLocations.some(loc => removedFiles.includes(loc)))
      continue;

    let ruleIndex = sarifRules.findIndex(rule => rule.id === res.ruleId);
    if (
      ruleIndex === -1 &&
      res.ruleIndex &&
      oldAnalysisResults.sarif.runs[0].tool.driver.rules &&
      oldAnalysisResults.sarif.runs[0].tool.driver.rules[res.ruleIndex]
    ) {
      const newLength = sarifRules.push(oldAnalysisResults.sarif.runs[0].tool.driver.rules[res.ruleIndex]);
      ruleIndex = newLength - 1;
    }
    res.ruleIndex = ruleIndex;
    sarifResults.push(res);
  }
  newAnalysisResults.sarif.runs[0].results = sarifResults;
  newAnalysisResults.sarif.runs[0].tool.driver.rules = sarifRules;
  return newAnalysisResults;
}

const moveSuggestionIndexes = <T>(
  suggestionIndex: number,
  suggestions: { [index: string]: T },
): { [index: string]: T } => {
  const entries = Object.entries(suggestions);

  return entries.reduce((obj, [i, s]) => {
    obj[`${parseInt(i, 10) + suggestionIndex + 1}`] = s;
    return obj;
  }, {});
};

function mergeLegacyResults(
  oldAnalysisResults: AnalysisResultLegacy,
  newAnalysisResults: AnalysisResultLegacy,
  limitToFiles: string[],
  removedFiles: string[] = [],
  baseDir: string,
): AnalysisResultLegacy {
  // expand relative file names to absolute ones only for legacy results
  newAnalysisResults.files = normalizeResultFiles(newAnalysisResults.files, baseDir);

  // Determine max suggestion index in our data
  const suggestionIndex = Math.max(...Object.keys(oldAnalysisResults.suggestions).map(i => parseInt(i, 10))) || -1;

  // Addup all new suggestions' indexes
  const newSuggestions = moveSuggestionIndexes<Suggestion>(suggestionIndex, newAnalysisResults.suggestions);
  const suggestions = { ...oldAnalysisResults.suggestions, ...newSuggestions };

  const newFiles = Object.entries(newAnalysisResults.files).reduce((obj, [fn, s]) => {
    obj[fn] = moveSuggestionIndexes(suggestionIndex, s);
    return obj;
  }, {});

  // expand relative file names to absolute ones only for legacy results
  const changedFiles = [...limitToFiles, ...removedFiles].map(path => resolveBundleFilePath(baseDir, path));

  const files = {
    ...omit(oldAnalysisResults.files, changedFiles),
    ...newFiles,
  };

  return {
    ...newAnalysisResults,
    files,
    suggestions,
  };
}

export async function extendAnalysis(options: FileAnalysis & { files: string[] }): Promise<FileAnalysis | null> {
  const { files, removedFiles } = await prepareExtendingBundle(
    options.fileBundle.baseDir,
    options.fileBundle.supportedFiles,
    options.fileBundle.fileIgnores,

    options.files,

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

    files,
    removedFiles,
  });
  if (remoteBundle === null) return null;

  const fileBundle = {
    ...options.fileBundle,
    ...remoteBundle,
  };
  const limitToFiles = files.map(f => f.bundlePath);
  let analysisResults = await analyzeBundle({
    bundleHash: remoteBundle.bundleHash,
    ...options.connection,
    ...options.analysisOptions,
    shard: calcHash(fileBundle.baseDir),
    limitToFiles,
  });

  analysisResults = mergeBundleResults(
    options.analysisResults,
    analysisResults,
    limitToFiles,
    removedFiles,
    options.fileBundle.baseDir,
  );

  return { ...options, fileBundle, analysisResults };
}

/**
 * Perform an SCM-based analysis for an existing project,
 * with reporting of results to the platform.
 */
export async function analyzeScmProject(options: ScmAnalysisOptions): Promise<ScmAnalysis | null> {
  const connectionOptions = getConnectionOptions(options.connection);
  const analysisContext = getAnalysisContext(options.analysisContext);

  const { analysisResult: analysisResults, uploadResult: reportResults } = await reportScm({
    ...connectionOptions,
    ...options.analysisOptions,
    ...options.reportOptions,
    ...analysisContext,
  });

  return { analysisResults, reportResults };
}
