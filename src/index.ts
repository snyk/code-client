import { analyzeFolders, analyzeGit } from './analysis';
import emitter from './emitter';
import { startSession, checkSession, reportEvent, reportError } from './http';
import * as constants from './constants';

import { IFileBundle } from './interfaces/analysis-result.interface';

export {
  analyzeFolders,
  analyzeGit,
  startSession,
  checkSession,
  reportEvent,
  reportError,
  emitter,
  constants,
  IFileBundle,
};
