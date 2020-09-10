import queue from 'queue';
import { throttle } from 'lodash';

import { uploadFiles } from './http';
import Emitter from './emitter';

import { MAX_PAYLOAD, BUNDLE_ERRORS } from './constants';
import { IFileInfo, IFileQueue, IFileContent } from './interfaces/files.interface';
import { IQueueAnalysisCheck } from './interfaces/queue.interface';
import { IResult } from './interfaces/http.interface';

const loopDelay = 1000;
const emitUploadResult = throttle(Emitter.uploadBundleProgress.bind(Emitter), loopDelay);

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

// Create Chunks
export function createUploadChunks(files: IFileInfo[]): Array<IFileInfo[]> {
  const chunks = [];
  let currentSize = 0;
  let currentChunk: IFileInfo[] = [];

  files.forEach(fileInfo => {
    const { size } = fileInfo;
    const nextSize = currentSize + size;

    if (nextSize >= MAX_PAYLOAD) {
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
export function createUploadQueue(
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

export async function startAnalysisLoop(options: IQueueAnalysisCheck): Promise<void> {
  const { bundleId } = options;
  const emitAnalysisProgress = throttle(Emitter.analyseProgress.bind(Emitter), loopDelay);

  if (!bundleId) {
    console.debug('Analysis: no bundle ID');
    return Promise.resolve();
  }

  const result = await http.getAnalysis(options);

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
      return startAnalysisLoop(options);
    }
  }

  return Promise.resolve();
}

export async function processUploadFiles(
  baseURL: string,
  sessionToken: string,
  bundleId: string,
  filesInfo: IFileInfo[],
): Promise<string> {

  let uploadQueueFinished = false;
  let uploadQueueErrors = false;
  const processedChunks = {};

  // upload files:
  // 1. generate chunks from files: max 4 MB
  const chunks = createUploadChunks(filesInfo);

  // 2. generate and start queue
  const uploadQueue = createUploadQueue(baseURL, sessionToken, chunks, bundleId, uploadFiles);

  uploadQueue.on('success', (result: IQueueDebugInfo) => {
    const { chunkNumber } = result;
    if (processedChunks[chunkNumber]) {
      return;
    }

    processedChunks[chunkNumber] = true;
  });

  uploadQueue.on('end', () => {
    console.log('Upload Queue results:');
    if (uploadQueue.results) {
      uploadQueue.results.forEach((debugInfo, index) => {
        if (debugInfo.error) {
          uploadQueueErrors = true;
        }
        console.log(`- Result ${index}: ${JSON.stringify(debugInfo)}`.slice(0, 399));
      });
    }

    uploadQueueFinished = true;
    Emitter.uploadBundleFinish();
  });

  uploadQueue.start();

  // wait for upload queue is finished
  return new Promise(resolve => {
    const interval = setInterval(() => {
      if (uploadQueueFinished) {
        const resultBundleID = uploadQueueErrors ? '' : bundleId;
        clearInterval(interval);

        resolve(resultBundleID);
      }
    }, 200);
  });
}
