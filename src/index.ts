import { analyzeFolders, extendAnalysis, FileAnalysis } from './analysis';
import { createBundleFromFolders } from './bundles';
import { emitter } from './emitter';
import { startSession, checkSession, getAnalysis, getIpFamily, IpFamily } from './http';
import * as constants from './constants';
import { getGlobPatterns } from './files';

import { SupportedFiles } from './interfaces/files.interface';
import { AnalysisSeverity } from './interfaces/analysis-options.interface';
import { AnalysisResult, AnalysisResultLegacy, FilePath, FileSuggestion, Suggestion, Marker } from './interfaces/analysis-result.interface';

export {
  getGlobPatterns,
  analyzeFolders,
  createBundleFromFolders,
  extendAnalysis,
  emitter,
  constants,
  AnalysisSeverity,
  AnalysisResult,
  AnalysisResultLegacy,
  SupportedFiles,
  FileAnalysis,
  FilePath,
  FileSuggestion,
  Suggestion,
  Marker,
  getAnalysis,
  startSession,
  checkSession,
  getIpFamily,
  IpFamily,
};
