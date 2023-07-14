import { analyzeFolders, extendAnalysis, analyzeScmProject } from './analysis';
import { getSupportedFiles, createBundleFromFolders, createBundleWithCustomFiles } from './bundles';
import { emitter } from './emitter';
import { startSession, checkSession, getAnalysis, getIpFamily, IpFamily } from './http';
import { MAX_FILE_SIZE } from './constants';
import * as constants from './constants';
import { getGlobPatterns } from './files';

import { SupportedFiles, FileAnalysis } from './interfaces/files.interface';
import { AnalysisSeverity, AnalysisContext } from './interfaces/analysis-options.interface';
import {
  AnalysisResult,
  AnalysisResultSarif,
  AnalysisResultLegacy,
  FilePath,
  FileSuggestion,
  Suggestion,
  Marker,
  ReportResult,
  ScmAnalysis,
} from './interfaces/analysis-result.interface';

export {
  getGlobPatterns,
  analyzeFolders,
  analyzeScmProject,
  getSupportedFiles,
  createBundleFromFolders,
  createBundleWithCustomFiles,
  extendAnalysis,
  emitter,
  MAX_FILE_SIZE,
  constants,
  AnalysisSeverity,
  AnalysisResult,
  AnalysisResultSarif,
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
  AnalysisContext,
  ReportResult,
  ScmAnalysis,
};
