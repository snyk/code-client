import path from 'path';

export const PLUGIN = {
  name: 'deepcode',
  title: 'DeepCode (Beta)',
  statusTitle: 'DeepCode',
  ideName: 'atom',
  url: 'https://www.deepcode.ai',
  termURL: 'https://www.deepcode.ai/tc',

  dbName: 'DeepCodeDB',
  dbVersion: 1,

  pathSeparator: path.sep,
  isWindows: (path.sep === '\\'),

  maxFileSize: 4 * 1024 * 1024,

  // Max payload is 4 MB, but we will use 3.5 MB for files due to we need also to send
  // another info about files with their contents
  maxPayload: 3.5 * 1024 * 1024,

  // Delay in ms between starting analysis for changed files
  analysisDelay: 5 * 1000, // 5 sec

  problemsPanelURI: 'atom://deepcode-problems-panel',
};
