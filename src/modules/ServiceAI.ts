import { Files } from './Files';
import { Queues } from './Queues';
import { Http } from './Http';
import { Logger } from './Logger';
import { Emitter } from './Emitter';

import { IFileInfo } from '../interfaces/files.interface';
import { IQueueDebugInfo } from '../interfaces/queue.interface';

import {
  IServiceAI,
  StartSessionResponse,
  GetFiltersResponse,
  CreateBundleResponse,
  CheckBundleResponse,
  ExtendBundleResponse,
  UploadFilesResponse,
  GetAnalysisResponse,
  ReportErrorResponse,
} from '../interfaces/service-ai.interface';

import { StartSessionRequestDto } from '../dto/start-session.request.dto';
import { CheckSessionRequestDto } from '../dto/check-session.request.dto';
import { GetFiltersRequestDto } from '../dto/get-filters.request.dto';
import { CreateBundleRequestDto } from '../dto/create-bundle.request.dto';
import { CreateBundleResponseDto } from '../dto/create-bundle.response.dto';
import { CheckBundleRequestDto } from '../dto/check-bundle.request.dto';
import { ExtendBundleRequestDto } from '../dto/extend-bundle.request.dto';
import { UploadFilesRequestDto } from '../dto/upload-files.request.dto';
import { GetAnalysisRequestDto } from '../dto/get-analysis.request.dto';
import { AnalyseRequestDto } from '../dto/analyse.request.dto';
import { CheckBundleResponseDto } from '../dto/check-bundle.response.dto';
import { ExtendBundleResponseDto } from '../dto/extend-bundle.response.dto';
import { ReportErrorRequestDto } from '../dto/report-error.request.dto';

export class ServiceAI implements IServiceAI {
  private files = new Files();
  private queues = new Queues();
  private http = new Http();
  private logger = new Logger(false);
  public bundleId = '';

  processedChunks = {}; // cache for processed and stored chunks
  uploadQueueFinished = false;
  uploadQueueErrors = false;

  constructor() {
    this.queues.updateHttp(this.http);
  }

  public async startSession(options: StartSessionRequestDto): Promise<StartSessionResponse> {
    return this.http.startSession(options);
  }

  public checkSession(options: CheckSessionRequestDto): Promise<boolean> {
    return this.http.checkSession(options);
  }

  public async getFilters(options: GetFiltersRequestDto): Promise<GetFiltersResponse> {
    return this.http.getFilters(options);
  }

  public async createBundle(options: CreateBundleRequestDto): Promise<CreateBundleResponse> {
    return this.http.createBundle(options);
  }

  public async checkBundle(options: CheckBundleRequestDto): Promise<CheckBundleResponse> {
    return this.http.checkBundle(options);
  }

  public async extendBundle(options: ExtendBundleRequestDto): Promise<ExtendBundleResponse> {
    return this.http.extendBundle(options);
  }

  public async uploadFiles(options: UploadFilesRequestDto): Promise<UploadFilesResponse> {
    return this.http.uploadFiles(options);
  }

  public async getAnalysis(options: GetAnalysisRequestDto): Promise<GetAnalysisResponse> {
    return this.http.getAnalysis(options);
  }

  public async reportError(options: ReportErrorRequestDto): Promise<ReportErrorResponse> {
    return this.http.reportError(options);
  }

  public async processUploadFiles(
    baseURL: string,
    sessionToken: string,
    bundleId: string,
    filesInfo: IFileInfo[],
  ): Promise<string> {
    this.uploadQueueFinished = false;
    this.uploadQueueErrors = false;
    this.processedChunks = {};

    // upload files:
    // 1. generate chunks from files: max 4 MB
    const chunks = this.queues.createUploadChunks(filesInfo);

    // 2. generate and start queue
    const uploadQueue = this.queues.createUploadQueue(baseURL, sessionToken, chunks, bundleId, this.http.uploadFiles);

    uploadQueue.on('success', (result: IQueueDebugInfo) => {
      const { chunkNumber } = result;
      if (this.processedChunks[chunkNumber]) {
        return;
      }

      this.processedChunks[chunkNumber] = true;
    });

    uploadQueue.on('end', () => {
      this.logger.log('Upload Queue results:');
      if (uploadQueue.results) {
        uploadQueue.results.forEach((debugInfo, index) => {
          if (debugInfo.error) {
            this.uploadQueueErrors = true;
          }
          this.logger.log(`- Result ${index}: `, debugInfo);
        });
      }

      this.uploadQueueFinished = true;
      Emitter.uploadBundleFinish();
    });

    uploadQueue.start();

    // wait for upload queue is finished
    return new Promise(resolve => {
      const interval = setInterval(() => {
        if (this.uploadQueueFinished) {
          const resultBundleID = this.uploadQueueErrors ? '' : bundleId;
          clearInterval(interval);

          resolve(resultBundleID);
        }
      }, 200);
    });
  }

  public getMissingFilesInfo = (missingFiles: string[], filesInfo: IFileInfo[]): IFileInfo[] => {
    const missingFilesData: IFileInfo[] = [];

    return missingFiles.reduce((resultArr, missingFile) => {
      const fullInfo = filesInfo.find(fileInfo => fileInfo.path === missingFile);

      if (fullInfo) {
        resultArr.push(fullInfo);
      }

      return resultArr;
    }, missingFilesData);
  };

  public async analyse(options: AnalyseRequestDto): Promise<void> {
    try {
      const { baseURL, sessionToken, baseDir, files, removedFiles = [] } = options;
      const fullFilesInfo = await this.files.getFilesData(baseDir, files);
      const bundle = await this.files.buildBundle(fullFilesInfo);
      let missingFiles: string[] = [];

      if (!this.bundleId) {
        const createBundleResult = await this.createBundle({
          baseURL,
          sessionToken,
          files: bundle,
        });

        if (createBundleResult instanceof CreateBundleResponseDto) {
          this.bundleId = createBundleResult.bundleId;

          if (createBundleResult.missingFiles?.length) {
            missingFiles = [...createBundleResult.missingFiles];
          }
        }
      } else {
        const checkBundleResult = await this.checkBundle({
          baseURL,
          sessionToken,
          bundleId: this.bundleId,
        });

        if (checkBundleResult instanceof CheckBundleResponseDto) {
          if (checkBundleResult.missingFiles?.length) {
            missingFiles = [...checkBundleResult.missingFiles];
          }

          const extendResults = await this.extendBundle({
            baseURL,
            sessionToken,
            bundleId: this.bundleId,
            files: bundle,
            removedFiles,
          });

          if (extendResults instanceof ExtendBundleResponseDto) {
            this.bundleId = extendResults.bundleId;

            if (extendResults.missingFiles?.length) {
              missingFiles = [...extendResults.missingFiles];
            }
          }
        } else {
          const createBundleResult = await this.createBundle({
            baseURL,
            sessionToken,
            files: bundle,
          });

          if (createBundleResult instanceof CreateBundleResponseDto) {
            this.bundleId = createBundleResult.bundleId;

            if (createBundleResult.missingFiles?.length) {
              missingFiles = [...createBundleResult.missingFiles];
            }
          }
        }
      }

      if (missingFiles.length) {
        const missingFilesInfo = this.getMissingFilesInfo(missingFiles, fullFilesInfo);
        await this.processUploadFiles(baseURL, sessionToken, this.bundleId, missingFilesInfo);
      }
      this.queues.startAnalysisLoop({ baseURL, sessionToken, bundleId: this.bundleId });
    } catch (error) {
      Emitter.sendError(error);
      throw error;
    }

    return Promise.resolve();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(eventName: string, callback: Function, ...args: any[]): void {
    Emitter.on(eventName, callback, ...args);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit(eventName: string, ...args: any[]): void {
    Emitter.emit(eventName, ...args);
  }

  removeListeners(): void {
    Emitter.removeListeners();
  }
}
