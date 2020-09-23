import * as nodePath from 'path';
import * as fs from 'fs';
import fg from 'fast-glob';
import crypto, { HexBase64Latin1Encoding } from 'crypto';
import { union } from 'lodash';
import util from 'util';

import { HASH_ALGORITHM, ENCODE_TYPE, MAX_PAYLOAD, IGNORES_DEFAULT, IGNORE_FILES_NAMES } from './constants';

import { ISupportedFiles, IFileInfo } from './interfaces/files.interface';

const isWindows = nodePath.sep === '\\';

const lStat = util.promisify(fs.lstat);
const readFile = util.promisify(fs.readFile);

export function isFileSupported(path: string, supportedFiles: ISupportedFiles): boolean {
  return supportedFiles.configFiles.includes(path) || supportedFiles.extensions.includes(nodePath.extname(path));
}

export function parseFileIgnores(path: string): string[] {
  const dirname = nodePath.dirname(path);
  const f = fs.readFileSync(path, { encoding: 'utf8' });

  const rules = f
    .split('\n')
    .map(l => l.trim().replace(/\/$/, '')) // Remove white spaces and trim slashes
    .filter(l => !!l && !l.startsWith('#'));

  const results: string[] = [];
  for (const rule of rules) {
    results.push(nodePath.posix.join(dirname, rule));
    if (!rule.startsWith('/')) {
      results.push(nodePath.posix.join(dirname, '**', rule));
    }
  }
  return results;
}

function getGlobPatterns(supportedFiles: ISupportedFiles): string[] {
  return [...supportedFiles.extensions.map(e => `*${e}`), ...supportedFiles.configFiles];

  // return `**/\{${patterns.join(',')}\}`;
}

function* scanDir(
  path: string,
  globPatterns: string[],
  symlinksEnabled = false,
  fileIgnores: string[] = IGNORES_DEFAULT,
): Generator<fg.Entry> {
  let localFileIgnores = [...fileIgnores];

  // Check ignore files inside this directory
  const localIgnoreFiles = fg.sync(IGNORE_FILES_NAMES, {
    dot: true,
    absolute: true,
    cwd: path,
    deep: 1,
    ignore: localFileIgnores,
    caseSensitiveMatch: false,
    followSymbolicLinks: symlinksEnabled,
    onlyFiles: true,
    objectMode: false,
    stats: false,
  });

  // Read ignore files and merge new patterns
  const newIgnorePatterns = localIgnoreFiles.map(p => {
    console.debug('recognized ignore rules in file --> ', p);
    return parseFileIgnores(p);
  });
  if (newIgnorePatterns.length) {
    localFileIgnores = union(localFileIgnores, ...newIgnorePatterns);
  }

  // Scan files
  const localFiles = fg.sync(globPatterns, {
    dot: true,
    absolute: true,
    cwd: path,
    deep: 1,
    ignore: localFileIgnores,
    caseSensitiveMatch: false,
    followSymbolicLinks: symlinksEnabled,
    onlyFiles: true,
    objectMode: true,
    stats: true,
  });

  for (const f of localFiles) {
    yield f;
  }

  // Scan sub-directories
  const subDirs = fg.sync('**', {
    onlyDirectories: true,
    dot: true,
    absolute: true,
    cwd: path,
    deep: 1,
    ignore: localFileIgnores,
    caseSensitiveMatch: false,
    followSymbolicLinks: symlinksEnabled,
    objectMode: false,
    stats: false,
  });

  for (const d of subDirs) {
    for (const f of scanDir(d, globPatterns, symlinksEnabled, localFileIgnores)) {
      yield f;
    }
  }
}

export function determineBaseDir(paths: string[]): string {
  if (paths.length) {
    const path = paths[0];
    const stats = fs.lstatSync(path);
    if (stats.isFile()) {
      return nodePath.dirname(path);
    }

    return path;
  }
  return '';
}

/**
 * Returns bundle files from requested paths
 * */
export async function* collectBundleFiles(
  baseDir: string,
  paths: string[],
  supportedFiles: ISupportedFiles,
  maxFileSize = MAX_PAYLOAD,
  symlinksEnabled = false,
  fileIgnores: string[] = IGNORES_DEFAULT,
): AsyncGenerator<IFileInfo> {
  const globPatterns = getGlobPatterns(supportedFiles);

  for (const path of paths) {
    // eslint-disable-next-line no-await-in-loop
    const fileStats = await lStat(path);
    // Check if symlink and exclude if requested
    if (fileStats.isSymbolicLink() && !symlinksEnabled) continue;

    if (fileStats.isFile() && isFileSupported(path, supportedFiles)) {
      if (fileStats.size > maxFileSize) continue;
      yield getFileInfo(path, baseDir);
    } else if (fileStats.isDirectory()) {
      for (const entry of scanDir(path, globPatterns, symlinksEnabled, fileIgnores)) {
        if (entry.stats && entry.stats.size > maxFileSize) continue;

        yield getFileInfo(entry.path, baseDir);
      }
    }
  }
}

export async function getFileInfo(filePath: string, baseDir: string): Promise<IFileInfo> {
  const fileStats = await lStat(filePath);

  const fileContent = await readFile(filePath, 'utf8');
  const fileHash = crypto
    .createHash(HASH_ALGORITHM)
    .update(fileContent)
    .digest(ENCODE_TYPE as HexBase64Latin1Encoding);

  const relPath = nodePath.relative(baseDir, filePath);
  const posixPath = !isWindows ? relPath : relPath.replace('\\', '/');

  return {
    filePath,
    bundlePath: `/${posixPath}`,
    size: fileStats.size,
    hash: fileHash,
    content: fileContent,
  };
}

export async function resolveBundleFiles(baseDir: string, bundleMissingFiles: string[]): Promise<IFileInfo[]> {
  const tasks = bundleMissingFiles.map(mf => {
    const filePath = resolveBundleFilePath(baseDir, mf);
    return getFileInfo(filePath, baseDir);
  });

  return Promise.all(tasks);
}

export function resolveBundleFilePath(baseDir: string, bundleFilePath: string): string {
  let relPath = bundleFilePath.slice(1);

  if (isWindows) {
    relPath = relPath.replace('/', '\\');
  }

  return nodePath.resolve(baseDir, relPath);
}

export function* composeFilePayloads(files: IFileInfo[], bucketSize = MAX_PAYLOAD): Generator<IFileInfo[]> {
  type Bucket = {
    size: number;
    files: IFileInfo[];
  };
  const buckets: Bucket[] = [{ size: bucketSize, files: [] }];

  let bucketIndex = -1;
  const isLowerSize = (bucket: Bucket, fileData: IFileInfo) => bucket.size >= fileData.size;
  for (let fileData of files) {
    if (fileData.size > bucketSize) {
      // This file is too large. but it should not be here as previosly checked
      fileData = { ...fileData, size: 1, content: '' };
    }

    // Find suitable bucket
    bucketIndex = buckets.findIndex(b => isLowerSize(b, fileData));

    if (bucketIndex === -1) {
      // Create a new bucket
      buckets.push({ size: bucketSize, files: [] });
      bucketIndex = buckets.length - 1;
    }

    buckets[bucketIndex].files.push(fileData);
    buckets[bucketIndex].size -= fileData.size;

    if (buckets[bucketIndex].size < bucketSize * 0.01) {
      yield buckets[bucketIndex].files; // Give bucket to requester
      buckets.splice(bucketIndex); // Remove it as fullfilled
    }
  }

  // Send all left-over buckets
  for (const bucket of buckets.filter(b => b.files.length)) {
    yield bucket.files;
  }
}
