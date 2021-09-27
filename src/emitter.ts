import { EventEmitter } from 'events';

import { AnalysisResponseProgress } from './http';
import { SupportedFiles } from './interfaces/files.interface';

// eslint-disable-next-line no-shadow
enum CUSTOM_EVENTS {
  supportedFilesLoaded = 'supportedFilesLoaded',
  scanFilesProgress = 'scanFilesProgress',
  createBundleProgress = 'createBundleProgress',
  uploadBundleProgress = 'uploadBundleProgress',
  analyseProgress = 'analyseProgress',
  apiRequestLog = 'apiRequestLog',
  error = 'error',
}

export class EmitterDC extends EventEmitter {
  events = CUSTOM_EVENTS;

  supportedFilesLoaded(data: SupportedFiles | null): void {
    this.emit(CUSTOM_EVENTS.supportedFilesLoaded, data);
  }

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

  apiRequestLog(message: string): void {
    this.emit(CUSTOM_EVENTS.apiRequestLog, message);
  }
}

export const emitter = new EmitterDC();
