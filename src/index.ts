import { analyzeFolders, extendAnalysis, analyzeGit, analyzeGitDiff } from './analysis';
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
} from './interfaces/analysis-result.interface';

export {
  getGlobPatterns,
  analyzeFolders,
  extendAnalysis,
  analyzeGit,
  analyzeGitDiff,
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
  IGitBundle,
  ISupportedFiles,
};
