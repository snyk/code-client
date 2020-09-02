import queue from 'queue';
import Http from './Http';
import Emitter from './Emitter';

import { maxPayload } from '../constants/common';
import { BUNDLE_ERRORS } from '../constants/errors';
import { IFileInfo, IFileQueue } from '../interfaces/files.interface';
import { IQueueAnalysisCheck } from '../interfaces/queue.interface';

import throttle from '../utils/throttle';

const loopDelay = 1000;
const emitUploadResult = throttle(Emitter.uploadBundleProgress, loopDelay);

enum ANALYSIS_STATUS {
  fetching = 'FETCHING',
  analyzing = 'ANALYZING',
  dcDone = 'DC_DONE',
  done = 'DONE',
  failed = 'FAILED'
}

export default class Queues {
  private http = new Http();

  public updateHttp(http: Http): void {
    this.http = http;
  }

  // Create Chunks
  // eslint-disable-next-line class-methods-use-this
  public createUploadChunks(files: IFileInfo[]): Array<IFileInfo[]> {
    const chunks = [];
    let currentSize = 0;
    let currentChunk: IFileInfo[] = [];

    files.forEach(fileInfo => {
      const { size } = fileInfo;
      const nextSize = currentSize + size;

      if (nextSize >= maxPayload) {
        chunks.push(currentChunk);
        currentSize = size;
        currentChunk = [fileInfo];
        return;
      }

      currentSize = nextSize;
      currentChunk.push(fileInfo);
    });

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  // Create Queues
  // eslint-disable-next-line class-methods-use-this
  public createUploadQueue(
    baseURL: string,
    sessionToken: string,
    chunks: Array<IFileInfo[]>,
    bundleId: string,
    uploadFilesRunner: Function,
  ): IFileQueue {
    const q = queue({
      results: [],
      concurrency: 20,
      autostart: false,
    });

    const totalChunks = chunks.map(chunk => chunk.length).reduce((acc, curr) => acc + curr, 0);
    let currentChunk = 0;

    chunks.forEach((chunk, index) => {
      let chunkSize = 0;
      const requestBody = chunk.map(fileItem => {
        const { hash, size, content } = fileItem;
        chunkSize += size;

        return {
          fileHash: hash,
          fileContent: content,
        };
      });
      const debugInfo = {
        requestBody,
        chunkSize,
        chunkNumber: index,
        filesCount: chunk.length,
        files: chunk.map(fileItem => fileItem.path),
        errorText: '',
        error: '',
      };

      q.push(async () => {
        const { error, statusCode } = await uploadFilesRunner({
          baseURL,
          sessionToken,
          bundleId,
          content: requestBody,
        });

        if (error) {
          debugInfo.errorText = BUNDLE_ERRORS.upload[statusCode] || error.message;
          debugInfo.error = error;
        }

        currentChunk += chunk.length;
        emitUploadResult(currentChunk, totalChunks);

        return debugInfo;
      });
    });

    return q;
  }

  async startAnalysisLoop(options: IQueueAnalysisCheck): Promise<void> {
    const { bundleId } = options;
    const emitAnalysisProgress = throttle(Emitter.analyseProgress, loopDelay);

    if (!bundleId) {
      console.debug('Analysis: no bundle ID');
      return Promise.resolve();
    }

    const result = await this.http.getAnalysis(options);

    if (result.type === 'success') {
      const { status, analysisResults, analysisURL, progress } = result;

      const newProgress = progress || 0.01;

      const inProgress =
        status === ANALYSIS_STATUS.fetching ||
        status === ANALYSIS_STATUS.analyzing ||
        status === ANALYSIS_STATUS.dcDone;

      if (status === ANALYSIS_STATUS.done) {
        if (analysisResults) {
          Emitter.analyseFinish({ analysisResults, progress: 1.0, analysisURL });
        }
      }

      if (inProgress) {
        emitAnalysisProgress({ analysisResults, progress: newProgress, analysisURL });
        this.nextAnalysisLoopTick(options);
      }

      return Promise.resolve();
    }

    return Promise.resolve();
  }

  async nextAnalysisLoopTick(options: IQueueAnalysisCheck): Promise<void> {
    setTimeout(async () => {
      await this.startAnalysisLoop(options);
    }, loopDelay);

    return Promise.resolve();
  }
}
