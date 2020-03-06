import { Agent } from './Agent';
import { Files } from './Files';
import { Queues } from './Queues';
import { Http } from './Http';
import { Logger } from './Logger';
import { Emitter } from './Emitter';

import { IConfig } from '../interfaces/config.interface';
import { IFileInfo } from '../interfaces/files.interface';
import { IQueueDebugInfo } from '../interfaces/queue.interface';

import {
  IServiceAI,
  StartSessionResponse,
  CheckSessionResponse,
  GetFiltersResponse,
  CreateBundleResponse,
  CheckBundleResponse,
  ExtendBundleResponse,
  UploadFilesResponse,
  GetAnalysisResponse,
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

export class ServiceAI implements IServiceAI {
  private agent = new Agent();
  private files = new Files();
  private queues = new Queues();
  private http = new Http();
  private logger = new Logger(false);

  processedChunks = {}; // cache for processed and stored chunks
  uploadQueueFinished = false;
  uploadQueueErrors = false;
  bundleId = '';

  public init(config: IConfig): void {
    this.agent.init(config);
    this.http.init(config);
  }

  public async startSession(options: StartSessionRequestDto): Promise<StartSessionResponse> {
    return this.http.startSession(options);
  }

  public async checkSession(options: CheckSessionRequestDto): Promise<CheckSessionResponse> {
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

  public async processUploadFiles(bundleId: string, filesInfo: IFileInfo[], sessionToken: string): Promise<string> {
    this.uploadQueueFinished = false;
    this.uploadQueueErrors = false;
    this.processedChunks = {};

    // upload files:
    // 1. generate chunks from files: max 4 MB
    const chunks = this.queues.createUploadChunks(filesInfo);

    // 2. generate and start queue
    const uploadQueue = this.queues.createUploadQueue(chunks, bundleId, sessionToken, this.http.uploadFiles);

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

  public async analyse(options: AnalyseRequestDto): Promise<void> {
    try {
      const { files, sessionToken } = options;
      const fullFilesInfo = await this.files.getFilesData(files);
      const bundle = await this.files.buildBundle(files);

      if (!this.bundleId) {
        const result = await this.createBundle({
          files: bundle,
          sessionToken,
        });
        this.bundleId = result instanceof CreateBundleResponseDto ? result.bundleId : '';
      } else {
        const checkBundleResult = await this.checkBundle({
          bundleId: this.bundleId,
          sessionToken,
        });

        if (checkBundleResult instanceof CheckBundleResponseDto) {
          const extendResults = await this.extendBundle({
            files: bundle,
            sessionToken,
            bundleId: this.bundleId,
            removedFiles: [],
          });

          this.bundleId = extendResults instanceof ExtendBundleResponseDto ? extendResults.bundleId : this.bundleId;
        } else {
          const result = await this.createBundle({
            files: bundle,
            sessionToken,
          });
          this.bundleId = result instanceof CreateBundleResponseDto ? result.bundleId : '';
        }
      }

      await this.processUploadFiles(this.bundleId, fullFilesInfo, sessionToken);

      this.queues.startAnalysisLoop({ bundleId: this.bundleId, sessionToken });
    } catch (error) {
      Emitter.sendError(error);
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
}
