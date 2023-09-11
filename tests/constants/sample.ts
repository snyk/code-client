import path from 'path';
import fs from 'fs';

import { FileInfo } from '../../src/interfaces/files.interface';
import { getFileInfo, notEmpty } from '../../src/files';
import { ReportResult } from '../../src';

export const sampleProjectPath = path.resolve(__dirname, '../sample-repo');
export const supportedFiles = {
  extensions: ['.js', '.jsx', '.cpp', '.java'], // <= not aligned with currently returned extensions from backend
  configFiles: ['.eslintrc.json', '.dcignore', '.snyk'], // <= we are not running linters in the backend anymore
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
  `${sampleProjectPath}/**/exclude/excluded-file.js/**`,
  `${sampleProjectPath}/**/exclude/excluded-file.js`,
  `${sampleProjectPath}/exclude/excluded-folder/**`,
];

export const bundleFilePolicies = {
  excludes: [
    `${sampleProjectPath}/**/exclude/excluded-file.js/**`,
    `${sampleProjectPath}/**/exclude/excluded-file.js`,
    `${sampleProjectPath}/exclude/excluded-folder/**`,
  ],
  ignores: [
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
  ],
};

export const fileIgnoresFixtures = path.resolve(__dirname, '../fixtures/file-ignores');

export const bundleFilePaths = [
  '/.eslintrc.json', // <= we are not running linters in the backend anymore
  '.snyk',
  'AnnotatorTest.Cpp',
  'GitHubAccessTokenScrambler12.java',
  'app.js',
  'db.js',
  'main.js',
  'exclude/.snyk',
  'big-file.js', // <= file size is over the custom MAX_FILE_SIZE
  'routes/index.js',
  'routes/sharks.js',
  // TODO: This should be ignored for consistency with the .gitignore format (see last rule above),
  // however we decided to tune down correctness in favour of perfomance for now.
  'not/ignored/this_should_be_ignored.jsx',
  'not/ignored/this_should_not_be_ignored.java',
];

async function getBundleFiles(withContent: boolean, bundleFilePaths: Array<string>) {
  return (
    await Promise.all(
      bundleFilePaths.map(f => getFileInfo(path.join(sampleProjectPath, f), sampleProjectPath, withContent)),
    )
  ).filter(notEmpty);
}

export const bundleFiles: Promise<FileInfo[]> = getBundleFiles(false, bundleFilePaths);
export const bundleFilesFull: Promise<FileInfo[]> = getBundleFiles(true, bundleFilePaths);
export const singleBundleFull: Promise<FileInfo[]> = getBundleFiles(true, [bundleFilePaths[0]]);

export const bundleExtender: () => Promise<{
  files: { removed: string; changed: string; added: string; all: string[] };
  exec: () => void;
  restore: () => void;
}> = async () => {
  const fBundle = await bundleFilesFull;
  const changedFilesNames = [`GitHubAccessTokenScrambler12.java`, `AnnotatorTest.Cpp`];
  const addedFilesNames = [`GHATS12.java`];
  const [changedFiles, addedFiles] = [changedFilesNames, addedFilesNames].map(arr =>
    arr.map(name => `${sampleProjectPath}/${name}`),
  );
  const original = changedFiles.map(path => fBundle.find(f => f.filePath === path)?.content);
  if (original.some(c => !c)) throw new Error('Content not found. Impossible to restore');

  return {
    files: {
      removed: changedFilesNames[0],
      changed: changedFilesNames[1],
      added: addedFilesNames[0],
      all: [...addedFilesNames, ...changedFilesNames],
    },
    exec: () => {
      fs.writeFileSync(addedFiles[0], original![0]!);
      fs.unlinkSync(changedFiles[0]);
      fs.writeFileSync(changedFiles[1], `#include <fstream>`);
    },
    restore: () => {
      fs.writeFileSync(changedFiles[0], original![0]!);
      fs.writeFileSync(changedFiles[1], original![1]!);
      fs.unlinkSync(addedFiles[0]);
    },
  };
};

export const initReportReturn = 'test-reportId';

export const getReportReturn = {
  status: 'COMPLETE',
  uploadResult: {
    projectId: 'test-projectId',
    snapshotId: 'test-snapshotId',
    reportUrl: 'test-reportUrl',
  },
  analysisResult: {
    type: 'sarif',
    sarif: {},
  },
} as ReportResult;
