import { getFilesData, buildBundle } from './files';
import { startAnalysisLoop } from './queues';
import { getFilters } from './http';
import { CUSTOM_EVENTS, emitter } from './emitter';
import { defaultBaseURL } from './constants';

import { ISupportedFiles } from './interfaces/files.interface';
import { AnalysisSeverity, IAnalysisResult } from './interfaces/analysis-result.interface';

// 1. Create a bundle for paths from scratch. Return bundle info together with request details and analysis results. Create a class Bundle for this
// 2. class Bundle will implement method extend, that will conduct analysis and return another Bundle instance
// 3. Create a queue, that would manage bundle extensions

export default class Bundle {
  private readonly baseURL: string;
  private readonly sessionToken: string;
  private readonly includeLint: boolean;
  private readonly severity: AnalysisSeverity;
  private readonly paths: string[];

  public readonly supportedFiles: ISupportedFiles;

  private readonly bundleId: string;
  private readonly bundleFiles: string[];
  public readonly analysisResults: IAnalysisResult;
  public readonly analysisUrl: string;

  constructor(
    baseURL: string,
    sessionToken: string,
    includeLint: boolean,
    severity: AnalysisSeverity,
    supportedFiles: ISupportedFiles,
    paths: string[],
  ) {
    this.baseURL = baseURL;
    this.sessionToken = sessionToken;
    this.includeLint = includeLint;
    this.severity = severity;
    this.supportedFiles = supportedFiles;
    this.paths = paths;
  }

  static async create(
    baseURL = defaultBaseURL,
    sessionToken = '',
    includeLint = false,
    severity = AnalysisSeverity.info,
    paths: string[],
  ): Promise<Bundle> {
    const resp = await getFilters(baseURL);
    if (resp.type === 'error') {
      throw new Error('baseURL is incorrect or server is not reachable now');
    }
    const supportedFiles = resp.value;

    const bundleFiles = collectBundleFiles(paths, supportedFiles);
    const fileHashes = prepareBundleHashes(bundleFiles);
    // tqdm(bundle_files, desc='Calculated hashes', unit='files', leave=False) # progress bar

    const bundleId  = await fulfillBundle(fileHashes);

    const { analysisResults, analysisUrl } = await getAnalysis(bundleId, includeLint=this.includeLint, severity=this.severity);

    const bundle = new Bundle(baseURL, sessionToken, includeLint, severity, supportedFiles, paths);

    await bundle.analyse();

    return bundle;
  }

  public async extend(files: string[], removedFiles: string[]): Promise<Bundle> {
    return this;
  }

  // type AnalyseRequestDto = {
  //   readonly baseURL: string;
  //   readonly sessionToken: string;
  //   readonly useLinters?: boolean;
  //   readonly baseDir: string;
  //   readonly files: string[];
  //   readonly removedFiles: string[];
  // };

  // public async analyse(options: AnalyseRequestDto): Promise<void> {
  //   try {
  //     const { baseURL, sessionToken, baseDir, files, removedFiles = [] } = options;
  //     const fullFilesInfo = getFilesData(baseDir, files);
  //     const bundle = await buildBundle(fullFilesInfo);
  //     let missingFiles: string[] = [];

  //     if (!this.bundleId) {
  //       const createBundleResult = await this.http.createBundle({
  //         baseURL,
  //         sessionToken,
  //         files: bundle,
  //       });

  //       if (createBundleResult.type === 'error') {
  //         // TODO: process Error
  //         return;
  //       }

  //       this.bundleId = createBundleResult.value.bundleId;

  //       if (createBundleResult.value.missingFiles?.length) {
  //         missingFiles = [...createBundleResult.value.missingFiles];
  //       }
  //     } else {
  //       const checkBundleResult = await this.http.checkBundle({
  //         baseURL,
  //         sessionToken,
  //         bundleId: this.bundleId,
  //       });

  //       if (checkBundleResult.type === 'success') {
  //         if (checkBundleResult.value.missingFiles?.length) {
  //           missingFiles = [...checkBundleResult.value.missingFiles];
  //         }

  //         const extendResults = await this.http.extendBundle({
  //           baseURL,
  //           sessionToken,
  //           bundleId: this.bundleId,
  //           files: bundle,
  //           removedFiles,
  //         });

  //         if (extendResults.type === 'error') {
  //           // TODO: process Error
  //           return;
  //         }

  //         this.bundleId = extendResults.value.bundleId;

  //         if (extendResults.value.missingFiles?.length) {
  //           missingFiles = [...extendResults.value.missingFiles];
  //         }
  //       } else {
  //         const createBundleResult = await this.http.createBundle({
  //           baseURL,
  //           sessionToken,
  //           files: bundle,
  //         });

  //         if (createBundleResult.type === 'error') {
  //           // TODO: process Error
  //           return;
  //         }

  //         this.bundleId = createBundleResult.value.bundleId;

  //         if (createBundleResult.value.missingFiles?.length) {
  //           missingFiles = [...createBundleResult.value.missingFiles];
  //         }
  //       }
  //     }

  //     if (missingFiles.length) {
  //       const missingFilesInfo = this.getMissingFilesInfo(missingFiles, fullFilesInfo);
  //       await this.processUploadFiles(baseURL, sessionToken, this.bundleId, missingFilesInfo);
  //     }

  //     await startAnalysisLoop({ baseURL, sessionToken, bundleId: this.bundleId }).catch(error => {
  //       emitter.sendError(error);
  //       throw error;
  //     });
  //   } catch (error) {
  //     emitter.sendError(error);
  //     throw error;
  //   }
  // }

  static on(eventName: CUSTOM_EVENTS, callback: () => void): void {
    emitter.on(eventName, callback);
  }

  static removeListeners(): void {
    emitter.removeListeners();
  }
}
