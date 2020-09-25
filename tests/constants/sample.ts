import path from 'path';

import { IFileInfo } from '../../src/interfaces/files.interface';
import { getFileInfo } from '../../src/files';

export const sampleProjectPath = path.resolve(__dirname, '../sample-repo');
export const supportedFiles = {
  extensions: ['.js', '.cpp', '.java'],
  configFiles: ['.eslintrc.json', '.dcignore'],
};

export const bundleFilePaths = [
  'AnnotatorTest.cpp',
  'GitHubAccessTokenScrambler12.java',
  'app.js',
  'db.js',
  'main.js',
  'routes/index.js',
  'routes/sharks.js',
];

function getBundleFiles(withContent: boolean) {
  return Promise.all(
    bundleFilePaths.map(f => getFileInfo(path.join(sampleProjectPath, f), sampleProjectPath, withContent)),
  );
}

export const bundleFiles: Promise<IFileInfo[]> = getBundleFiles(false);
export const bundleFilesFull: Promise<IFileInfo[]> = getBundleFiles(true);
