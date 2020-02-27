import { CUSTOM_EVENTS } from '../constants/emitter';
import { IQueueAnalysisCheckResult } from '../interfaces/queue.interface';

const EventEmitter = require('events').EventEmitter;

class Emitter extends EventEmitter {
  buildBundleProgress(processed: number, total: number): void {
    this.emit(CUSTOM_EVENTS.buildBundleProgress, processed, total);
    // console.log(' %%%%%%%%%  FROM EMITTER: buildBundleProgress', processed, total);
  }

  buildBundleFinish(): void {
    this.emit(CUSTOM_EVENTS.buildBundleFinish, true);
    // console.log(' %%%%%%%%%  FROM EMITTER: buildBundleFinish');
  }

  uploadBundleProgress(processed: number, total: number): void {
    this.emit(CUSTOM_EVENTS.uploadBundleProgress, processed, total);
    // console.log(' %%%%%%%%%  FROM EMITTER: uploadBundleProgress', processed, total);
  }

  uploadBundleFinish(): void {
    this.emit(CUSTOM_EVENTS.uploadFilesFinish, true);
    // console.log(' %%%%%%%%%  FROM EMITTER: uploadBundleFinish');
  }

  analyseProgress(processed: number, total: number): void {
    this.emit(CUSTOM_EVENTS.analyseProgress, processed, total);
    // console.log(' %%%%%%%%%  FROM EMITTER: analyseProgress', processed, total);
  }

  analyseFinish(analysisResults: IQueueAnalysisCheckResult): void {
    this.emit(CUSTOM_EVENTS.analyseFinish, analysisResults);
    // console.log(' %%%%%%%%%  FROM EMITTER: analyseFinish', analysisResults);
  }

  error(error: Error): void {
    console.log(error);
  }

  constructor() {
    super();
    this.buildBundleProgress = this.buildBundleProgress.bind(this);
    this.uploadBundleProgress = this.uploadBundleProgress.bind(this);
  }
}

const EmitterInstance = new Emitter();

export { EmitterInstance as Emitter };
