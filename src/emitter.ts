import { EventEmitter } from 'events';

import { AnalysisResponseProgress } from './http';

// eslint-disable-next-line no-shadow
enum CUSTOM_EVENTS {
  scanFilesProgress = 'scanFilesProgress',
  computeHashProgress = 'computeHashProgress',
  createBundleProgress = 'createBundleProgress',
  uploadBundleProgress = 'uploadBundleProgress',
  analyseProgress = 'analyseProgress',
  error = 'error',
}

class EmitterDC extends EventEmitter {
  events = CUSTOM_EVENTS;

  scanFilesProgress(processed: number): void {
    this.emit(CUSTOM_EVENTS.scanFilesProgress, processed);
  }

  computeHashProgress(processed: number, total: number): void {
    this.emit(CUSTOM_EVENTS.computeHashProgress, processed, total);
  }

  createBundleProgress(processed: number, total: number): void {
    this.emit(CUSTOM_EVENTS.createBundleProgress, processed, total);
  }

  uploadBundleProgress(processed: number, total: number): void {
    this.emit(CUSTOM_EVENTS.uploadBundleProgress, processed, total);
  }

  analyseProgress(data: AnalysisResponseProgress): void {
    this.emit(CUSTOM_EVENTS.analyseProgress, data);
  }

  sendError(error: Error): void {
    this.emit(CUSTOM_EVENTS.error, error);
  }

  removeListeners(): void {
    this.removeAllListeners();
  }
}

const emitter = new EmitterDC();
export default emitter;
