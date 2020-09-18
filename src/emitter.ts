import { EventEmitter } from 'events';

import { AnalysisResponseProgress } from './http';

// eslint-disable-next-line no-shadow
enum CUSTOM_EVENTS {
  scanFilesProgress = 'scanFilesProgress',
  createBundleProgress = 'createBundleProgress',
  uploadBundleProgress = 'uploadBundleProgress',
  analyseProgress = 'analyseProgress',
  error = 'error',
}

export class EmitterDC extends EventEmitter {
  events = CUSTOM_EVENTS;

  scanFilesProgress(processed: number): void {
    this.emit(CUSTOM_EVENTS.scanFilesProgress, processed);
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
}

const emitter = new EmitterDC();
export default emitter;
