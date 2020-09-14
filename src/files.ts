import * as nodePath from 'path';
// import { Buffer } from 'buffer';
import * as fs from 'fs';
import fg from 'fast-glob';
import crypto, { HexBase64Latin1Encoding } from 'crypto';
import { union } from 'lodash';
import { CustomDCIgnore, DefaultDCIgnore } from '@deepcode/dcignore';

import { HASH_ALGORITHM, ENCODE_TYPE, MAX_PAYLOAD, IGNORES_DEFAULT, IGNORE_FILES_NAMES } from './constants';

import { ISupportedFiles, IFileInfo } from './interfaces/files.interface';

const isWindows = nodePath.sep === '\\';

const DCIGNORE_DRAFTS = {
  custom: CustomDCIgnore,
  default: DefaultDCIgnore,
};

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
): Generator<string> {
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
    objectMode: false,
    stats: false,
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

/**
 * Returns bundle files from requested paths
 * */
export function collectBundleFiles(
  paths: string[],
  supportedFiles: ISupportedFiles,
  symlinksEnabled = false,
  fileIgnores: string[] = IGNORES_DEFAULT,
): string[] {
  const globPatterns = getGlobPatterns(supportedFiles);
  const files: string[] = [];

  for (const path of paths) {
    // Check if symlink and exclude if requested

    // TODO: check lstatSync
    const fileStats = fs.statSync(path);
    if (fileStats.isSymbolicLink() && !symlinksEnabled) continue;

    if (fileStats.isFile() && isFileSupported(path, supportedFiles)) {
      files.push(path);
    } else if (fileStats.isDirectory()) {
      for (const f of scanDir(path, globPatterns, symlinksEnabled, fileIgnores)) {
        files.push(f);
      }
    }
  }

  return files;
}

export function getFileMeta(filePath: string): IFileInfo {
  const fileStats = fs.statSync(filePath);

  const fileContent = fs.readFileSync(filePath).toString('utf8');
  const fileHash = crypto
    .createHash(HASH_ALGORITHM)
    .update(fileContent)
    .digest(ENCODE_TYPE as HexBase64Latin1Encoding);

  return {
    size: fileStats.size,
    path: filePath,
    hash: fileHash,
    content: fileContent,
  };
}

export function* prepareBundleHashes(files: string[], maxFileSize = MAX_PAYLOAD): Generator<IFileInfo> {
  // Read all files and return list of objects with path and hash
  let info: IFileInfo | null = null;
  for (const filePath of files) {
    info = getFileMeta(filePath);
    if (info.size <= maxFileSize) {
      yield info;
    }
  }
}

export function prepareFilePath(filePath: string): string {
  // os.path.relpath(filepath)
  const relpath = !isWindows ? filePath : filePath.replace('\\', '/');
  return `/${relpath}`;
}

export function resolveFilePath(bundleFilepath: string): string {
  let path = bundleFilepath.slice(1);

  if (isWindows) {
    path = path.replace('/', '\\');
  }

  // return os.path.abspath(path)
  return path;
}

export function* composeFilePayloads(missingFiles: string[], bucketSize = MAX_PAYLOAD): Generator<IFileInfo[]> {
  type Bucket = {
    size: number;
    files: IFileInfo[];
  };
  const buckets: Bucket[] = [{ size: bucketSize, files: [] }];

  let bucketIndex = -1;
  let fileData: IFileInfo;
  const isLowerSize = (bucket: Bucket) => bucket.size >= fileData.size;
  for (const rawFilePath of missingFiles) {
    fileData = getFileMeta(resolveFilePath(rawFilePath));

    if (fileData.size > bucketSize) {
      // This file is too large. but it should not be here as previosly checked
      fileData = { ...fileData, size: 1, content: '' };
    }

    // Find suitable bucket
    bucketIndex = buckets.findIndex(isLowerSize);

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
