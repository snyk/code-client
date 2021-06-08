import path from 'path';

import { FileInfo } from '../../src/interfaces/files.interface';
import { getFileInfo, notEmpty } from '../../src/files';

export const sampleProjectPath = path.resolve(__dirname, '../sample-repo');
export const supportedFiles = {
  extensions: ['.js', '.jsx', '.cpp', '.java'],
  configFiles: ['.eslintrc.json', '.dcignore'],
};

export const bundleFileIgnores = [
  '**/.git/**',
  `${sampleProjectPath}/**/mode_nodules/**`,
  `${sampleProjectPath}/models/**`,
  `${sampleProjectPath}/**/controllers/**`,
  `${sampleProjectPath}/**/ignored/**`,
  `${sampleProjectPath}/**/ignored`,
  `!${sampleProjectPath}/**/not/ignored/**`,
  `!${sampleProjectPath}/**/not/ignored`,
  `${sampleProjectPath}/**/*.jsx/**`,
  `${sampleProjectPath}/**/*.jsx`,
];

export const bundleFilePaths = [
  '/.eslintrc.json',
  'AnnotatorTest.cpp',
  'GitHubAccessTokenScrambler12.java',
  'app.js',
  'db.js',
  'main.js',
  'routes/index.js',
  'routes/sharks.js',
  // TODO: This should be ignored for consistency with the .gitignore format (see last rule above),
  // however we decided to tune down correctness in favour of perfomance for now.
  'not/ignored/this_should_be_ignored.jsx',
  'not/ignored/this_should_not_be_ignored.java',
];

async function getBundleFiles(withContent: boolean) {
  return (
    await Promise.all(
      bundleFilePaths.map(f => getFileInfo(path.join(sampleProjectPath, f), sampleProjectPath, withContent)),
    )
  ).filter(notEmpty);
}

export const bundleFiles: Promise<FileInfo[]> = getBundleFiles(false);
export const bundleFilesFull: Promise<FileInfo[]> = getBundleFiles(true);
