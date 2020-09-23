import { analyzeFolders, analyzeGit } from './analysis';
import emitter from './emitter';
import { startSession, checkSession, reportEvent, reportError } from './http';
import * as constants from './constants';

import {
  IFileSuggestion,
  IFilePath,
  IMarker,
  ISuggestion,
  ISuggestions,
  IAnalysisResult,
  IFileBundle,
} from './interfaces/analysis-result.interface';

export {
  analyzeFolders,
  analyzeGit,
  startSession,
  checkSession,
  reportEvent,
  reportError,
  emitter,
  constants,
  IFileSuggestion,
  IFilePath,
  IMarker,
  ISuggestion,
  ISuggestions,
  IAnalysisResult,
  IFileBundle,
};
