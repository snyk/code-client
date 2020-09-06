import Files from './Files';
import Queues from './Queues';
import Http from './Http';
import Emitter from './Emitter';

import { IFileInfo } from '../interfaces/files.interface';
import { IQueueDebugInfo } from '../interfaces/queue.interface';

import AnalyseRequestDto from '../dto/analyse.request.dto';

export default class ServiceAI {
  private files = new Files();
  private queues = new Queues();
  public http = new Http();
  public bundleId = '';

  processedChunks = {}; // cache for processed and stored chunks
  uploadQueueFinished = false;
  uploadQueueErrors = false;

  constructor() {
    this.queues.updateHttp(this.http);
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
    const uploadQueue = this.queues.createUploadQueue(
      baseURL,
      sessionToken,
      chunks,
      bundleId,
      this.http.uploadFiles.bind(this),
    );

    uploadQueue.on('success', (result: IQueueDebugInfo) => {
      const { chunkNumber } = result;
      if (this.processedChunks[chunkNumber]) {
        return;
      }

      this.processedChunks[chunkNumber] = true;
    });

    uploadQueue.on('end', () => {
      console.log('Upload Queue results:');
      if (uploadQueue.results) {
        uploadQueue.results.forEach((debugInfo, index) => {
          if (debugInfo.error) {
            this.uploadQueueErrors = true;
          }
          console.log(`- Result ${index}: ${JSON.stringify(debugInfo)}`.slice(0, 399));
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
      const fullFilesInfo = this.files.getFilesData(baseDir, files);
      const bundle = await this.files.buildBundle(fullFilesInfo);
      let missingFiles: string[] = [];

      if (!this.bundleId) {
        const createBundleResult = await this.http.createBundle({
          baseURL,
          sessionToken,
          files: bundle,
        });

        if (createBundleResult.type === 'error') {
          // TODO: process Error
          return;
        }

        this.bundleId = createBundleResult.value.bundleId;

        if (createBundleResult.value.missingFiles?.length) {
          missingFiles = [...createBundleResult.value.missingFiles];
        }
      } else {
        const checkBundleResult = await this.http.checkBundle({
          baseURL,
          sessionToken,
          bundleId: this.bundleId,
        });

        if (checkBundleResult.type === 'success') {
          if (checkBundleResult.value.missingFiles?.length) {
            missingFiles = [...checkBundleResult.value.missingFiles];
          }

          const extendResults = await this.http.extendBundle({
            baseURL,
            sessionToken,
            bundleId: this.bundleId,
            files: bundle,
            removedFiles,
          });

          if (extendResults.type === 'error') {
            // TODO: process Error
            return;
          }

          this.bundleId = extendResults.value.bundleId;

          if (extendResults.value.missingFiles?.length) {
            missingFiles = [...extendResults.value.missingFiles];
          }
        } else {
          const createBundleResult = await this.http.createBundle({
            baseURL,
            sessionToken,
            files: bundle,
          });

          if (createBundleResult.type === 'error') {
            // TODO: process Error
            return;
          }

          this.bundleId = createBundleResult.value.bundleId;

          if (createBundleResult.value.missingFiles?.length) {
            missingFiles = [...createBundleResult.value.missingFiles];
          }
        }
      }

      if (missingFiles.length) {
        const missingFilesInfo = this.getMissingFilesInfo(missingFiles, fullFilesInfo);
        await this.processUploadFiles(baseURL, sessionToken, this.bundleId, missingFilesInfo);
      }

      await this.queues.startAnalysisLoop({ baseURL, sessionToken, bundleId: this.bundleId }).catch(error => {
        Emitter.sendError(error);
        throw error;
      });
    } catch (error) {
      Emitter.sendError(error);
      throw error;
    }
  }

  // eslint-disable-next-line @typescript-eslint/ban-types, class-methods-use-this
  on(eventName: string, callback: Function, ...args: any[]): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    Emitter.on(eventName, () => callback(...args));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line class-methods-use-this
  emit(eventName: string, ...args: any[]): void {
    Emitter.emit(eventName, ...args);
  }

  // eslint-disable-next-line class-methods-use-this
  removeListeners(): void {
    Emitter.removeListeners();
  }
}
