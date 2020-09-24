import { analyzeFolders, analyzeGit } from './analysis';
import emitter from './emitter';
import { startSession, checkSession, reportEvent, reportError } from './http';
import * as constants from './constants';
import { getGlobPatterns } from './files';

import { ISupportedFiles } from './interfaces/files.interface';

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
  getGlobPatterns,
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
  ISupportedFiles,
};
