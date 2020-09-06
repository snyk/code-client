import queue from 'queue';
import Http from './Http';
import Emitter from './Emitter';

import { maxPayload } from '../constants/common';
import { BUNDLE_ERRORS } from '../constants/errors';
import { IFileInfo, IFileQueue, IFileContent } from '../interfaces/files.interface';
import { IQueueAnalysisCheck } from '../interfaces/queue.interface';
import { AnalysisStatus } from '../dto/get-analysis.response.dto';
import UploadFilesRequestDto from '../dto/upload-files.request.dto';
import { IResult } from '../interfaces/http.interface';

import throttle from '../utils/throttle';

const loopDelay = 1000;
const emitUploadResult = throttle(Emitter.uploadBundleProgress.bind(Emitter), loopDelay);

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

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
    uploadFilesRunner: (options: UploadFilesRequestDto) => Promise<IResult<boolean>>,
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
        } as IFileContent;
      });
      const debugInfo = {
        requestBody,
        chunkSize,
        chunkNumber: index,
        filesCount: chunk.length,
        files: chunk.map(fileItem => fileItem.path),
        errorText: '',
        error: false,
      };

      q.push(async () => {
        const uploadResponse = await uploadFilesRunner({
          baseURL,
          sessionToken,
          bundleId,
          content: requestBody,
        });

        if (uploadResponse.type === 'error') {
          const { error } = uploadResponse;
          debugInfo.errorText = ((error.statusCode && BUNDLE_ERRORS.upload[error.statusCode]) ||
            error.statusText) as string;
          debugInfo.error = true;
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
    const emitAnalysisProgress = throttle(Emitter.analyseProgress.bind(Emitter), loopDelay);

    if (!bundleId) {
      console.debug('Analysis: no bundle ID');
      return Promise.resolve();
    }

    const result = await this.http.getAnalysis(options);

    if (result.type === 'success') {
      const { status, analysisResults, analysisURL, progress } = result.value;

      const newProgress = progress || 0.01;

      const inProgress = [AnalysisStatus.fetching, AnalysisStatus.analyzing, AnalysisStatus.dcDone].includes(status);

      if (status === AnalysisStatus.done) {
        if (analysisResults) {
          Emitter.analyseFinish({ analysisResults, progress: 1.0, analysisURL });
        }
      }

      if (inProgress) {
        emitAnalysisProgress({ analysisResults, progress: newProgress, analysisURL });

        await sleep(loopDelay);
        return this.startAnalysisLoop(options);
      }

      return Promise.resolve();
    }

    return Promise.resolve();
  }
}
