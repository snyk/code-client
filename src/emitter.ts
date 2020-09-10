import { EventEmitter } from 'events';

import { IQueueAnalysisCheckResult } from './interfaces/queue.interface';

// eslint-disable-next-line no-shadow
export enum CUSTOM_EVENTS {
  buildBundleProgress = 'buildBundleProgress',
  buildBundleFinish = 'buildBundleFinish',
  createBundleProgress = 'createBundleProgress',
  createBundleFinish = 'createBundleFinish',
  uploadBundleProgress = 'uploadBundleProgress',
  uploadFilesFinish = 'uploadFilesFinish',
  analyseProgress = 'analyseProgress',
  analyseFinish = 'analyseFinish',
  error = 'error',
}

class Emitter extends EventEmitter {
  buildBundleProgress(processed: number, total: number): void {
    this.emit(CUSTOM_EVENTS.buildBundleProgress, processed, total);
  }

  buildBundleFinish(): void {
    this.emit(CUSTOM_EVENTS.buildBundleFinish, true);
  }

  uploadBundleProgress(processed: number, total: number): void {
    this.emit(CUSTOM_EVENTS.uploadBundleProgress, processed, total);
  }

  uploadBundleFinish(): void {
    this.emit(CUSTOM_EVENTS.uploadFilesFinish, true);
  }

  analyseProgress(analysisResults: IQueueAnalysisCheckResult): void {
    this.emit(CUSTOM_EVENTS.analyseProgress, analysisResults);
  }

  analyseFinish(analysisResults: IQueueAnalysisCheckResult): void {
    this.emit(CUSTOM_EVENTS.analyseFinish, analysisResults);
  }

  sendError(error: Error): void {
    this.emit(CUSTOM_EVENTS.error, error);
  }

  removeListeners(): void {
    this.removeAllListeners();
  }
}

export const emitter = new Emitter();
