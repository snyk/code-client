import { analyzeFolders, extendAnalysis, analyzeGit, createBundleFromFolders } from './analysis';
import emitter from './emitter';
import { startSession, checkSession, reportEvent, reportError } from './http';
import * as constants from './constants';
import { getGlobPatterns } from './files';

import { ISupportedFiles } from './interfaces/files.interface';

import {
  AnalysisSeverity,
  IFileSuggestion,
  IFilePath,
  IMarker,
  ISuggestion,
  ISuggestions,
  IAnalysisResult,
  IFileBundle,
  IGitBundle,
} from './interfaces/analysis-result.interface';

export {
  getGlobPatterns,
  analyzeFolders,
  createBundleFromFolders,
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
