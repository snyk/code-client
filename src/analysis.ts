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

function mergeBundleResults(
  oldAnalysisResults: AnalysisResult,
  newAnalysisResults: AnalysisResult,
  limitToFiles: string[],
  removedFiles: string[] = [],
): AnalysisResult {
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
  for (let res of oldResults) {
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
    const locations: string[] = (res.locations || []).reduce<string[]>(
      (acc, loc) => {
        if (loc.physicalLocation?.artifactLocation?.uri) {
          acc.push(loc.physicalLocation!.artifactLocation!.uri!);
        };
        return acc;
      }, []
    );
    const codeFlowLocations: string[] = (res.codeFlows || []).reduce<string[]>(
      (acc1, cf) => {
        acc1.push(...(cf.threadFlows || []).reduce<string[]>(
          (acc2, tf) => {
              acc2.push(...(tf.locations || []).reduce<string[]>(
                (acc3, loc) => {
                  if (loc.location?.physicalLocation?.artifactLocation?.uri) {
                    acc3.push(loc.location!.physicalLocation!.artifactLocation!.uri!);
                  };
                  return acc3;
                }, []
              ));
              return acc2;
            }, []
        ));
        return acc1; 
      }, []
    );
    if (
      locations.some(loc => changedFiles.includes(loc)) ||
      codeFlowLocations.some(loc => removedFiles.includes(loc))
    ) continue;
    
    let ruleIndex = sarifRules.findIndex((rule) => rule.id === res.ruleId);
    if (
      ruleIndex === -1 && res.ruleIndex &&
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
  const limitToFiles = files.map(f => f.bundlePath);
  let analysisResults = await analyzeBundle({
    bundleHash: remoteBundle.bundleHash,
    ...options.connection,
    ...options.analysisOptions,
    limitToFiles,
  });

  // TODO: Transform relative paths into absolute
  // analysisData.analysisResults.files = normalizeResultFiles(analysisData.analysisResults.files, bundle.baseDir);

  analysisResults = mergeBundleResults(options.analysisResults, analysisResults, limitToFiles, removedFiles);

  return { ...options, fileBundle, analysisResults };
}
