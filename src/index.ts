import { analyzeFolders, extendAnalysis, analyzeGit } from './analysis';
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
  IGitBundle,
  AnalysisSeverity,
} from './interfaces/analysis-result.interface';

export {
  getGlobPatterns,
  analyzeFolders,
  extendAnalysis,
  analyzeGit,
  startSession,
  checkSession,
  reportEvent,
  reportError,
  emitter,
  constants,
  AnalysisSeverity,
  IFileSuggestion,
  IFilePath,
  IMarker,
  ISuggestion,
  ISuggestions,
  IAnalysisResult,
  IFileBundle,
  IGitBundle,
  ISupportedFiles,
};
