import queue from 'queue';

import { Logger } from './Logger';
import { Http } from './Http';

import { PLUGIN } from '../constants/common';
import { BUNDLE_ERRORS } from '../constants/messages';
import { ANALYSIS_STATUS } from '../constants/analysis';
import { IFileInfo, IFileQueue } from '../interfaces/files.interface';
import { IQueueAnalysisCheck } from '../interfaces/queue.interface';
import { GetAnalysisResponseDto } from '../dto/get-analysis.response.dto';

const loopDelay = 1000;

export class Queues {
  private logger = new Logger(false);
  private http = new Http();

  // Create Chunks
  public createUploadChunks(files: IFileInfo[]): Array<IFileInfo[]> {
    const chunks = [];
    let currentSize = 0;
    let currentChunk: IFileInfo[] = [];

    files.forEach(fileInfo => {
      const { size } = fileInfo;
      const nextSize = currentSize + size;

      if (nextSize >= PLUGIN.maxPayload) {
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
  public createUploadQueue(
    chunks: Array<IFileInfo[]>,
    bundleId: string,
    sessionToken: string,
    uploadFilesRunner: Function,
  ): IFileQueue {
    const q = queue({
      results: [],
      concurrency: 10,
      autostart: false,
    });

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
        const { error, statusCode } = await uploadFilesRunner({ sessionToken, bundleId, content: requestBody });
        if (error) {
          debugInfo.errorText = BUNDLE_ERRORS.upload[statusCode] || error.message;
          debugInfo.error = error;
        }
        return debugInfo;
      });
    });

    return q;
  }

  async startAnalysisLoop(options: IQueueAnalysisCheck): Promise<void> {
    const { bundleId, onAnalysisFinish } = options;

    if (!bundleId) {
      this.logger.log('Analysis: no bundle ID');
      return Promise.resolve();
    }

    const result = await this.http.getAnalysis(options);

    if (result instanceof GetAnalysisResponseDto) {
      const { status, analysisResults, analysisURL } = result;

      const inProgress =
        status === ANALYSIS_STATUS.fetching ||
        status === ANALYSIS_STATUS.analyzing ||
        status === ANALYSIS_STATUS.dcDone;

      if (status === ANALYSIS_STATUS.done) {
        if (onAnalysisFinish) {
          onAnalysisFinish({ analysisResults, analysisURL });
        }
      }

      if (inProgress) {
        this.nextAnalysisLoopTick(options);
      }

      return Promise.resolve();
    }
  }

  async nextAnalysisLoopTick(options: IQueueAnalysisCheck): Promise<void> {
    setTimeout(async () => {
      await this.startAnalysisLoop(options);
    }, loopDelay);

    return Promise.resolve();
  }
}
