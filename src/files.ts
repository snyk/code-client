import * as nodePath from 'path';
import * as fs from 'fs';
import fg from 'fast-glob';
import crypto, { HexBase64Latin1Encoding } from 'crypto';
import { union } from 'lodash';
import util from 'util';
import flatCache from 'flat-cache';

import { HASH_ALGORITHM, ENCODE_TYPE, MAX_PAYLOAD, IGNORES_DEFAULT, IGNORE_FILES_NAMES, CACHE_KEY } from './constants';

import { ISupportedFiles, IFileInfo } from './interfaces/files.interface';

const isWindows = nodePath.sep === '\\';

const lStat = util.promisify(fs.lstat);

type CachedData = [number, number, string];

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
    if (rule.startsWith('/') || rule.startsWith('**')) {
      results.push(nodePath.posix.join(dirname, rule));
    } else {
      results.push(nodePath.posix.join(dirname, '**', rule));
    }
  }
  return results;
}

export function getGlobPatterns(supportedFiles: ISupportedFiles): string[] {
  return [
    ...supportedFiles.extensions.map(e => `*${e}`),
    ...supportedFiles.configFiles.filter(e => !IGNORE_FILES_NAMES.includes(e)),
  ];
  // return `**/\{${patterns.join(',')}\}`;
}

export async function collectIgnoreRules(
  dirs: string[],
  symlinksEnabled = false,
  fileIgnores: string[] = IGNORES_DEFAULT,
): Promise<string[]> {
  const tasks = dirs.map(async folder => {
    const fileStats = await lStat(folder);
    // Check if symlink and exclude if requested
    if ((fileStats.isSymbolicLink() && !symlinksEnabled) || fileStats.isFile()) return [];

    // Find ignore files inside this directory
    const localIgnoreFiles = await fg(
      IGNORE_FILES_NAMES.map(f => `${folder}**/${f}`),
      {
        dot: true,
        absolute: true,
        ignore: fileIgnores,
        caseSensitiveMatch: true,
        followSymbolicLinks: symlinksEnabled,
        onlyFiles: true,
        objectMode: false,
        stats: false,
      },
    );

    // Read ignore files and merge new patterns
    return union(...localIgnoreFiles.map(p => parseFileIgnores(p)));
  });

  return union(fileIgnores, ...(await Promise.all(tasks)));
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

async function* searchFiles(
  patterns: string[],
  cwd: string,
  maxFileSize = MAX_PAYLOAD,
  symlinksEnabled: boolean,
  ignores: string[],
): AsyncGenerator<fg.Entry> {
  const relIgnores = ignores.map(i => {
    if (i.startsWith(cwd)) {
      return i.slice(cwd.length + 1);
    }
    return i;
  });

  const entries = await fg(patterns, {
    dot: true,
    absolute: true,
    cwd,
    ignore: relIgnores,
    caseSensitiveMatch: true,
    followSymbolicLinks: symlinksEnabled,
    onlyFiles: true,
    objectMode: true,
    stats: true,
  });

  for (const entry of entries) {
    if (entry.stats && entry.stats.size <= maxFileSize) {
      yield entry;
    }
  }
}

/**
 * Returns bundle files from requested paths
 * */
export async function* collectBundleFiles(
  baseDir: string,
  paths: string[],
  supportedFiles: ISupportedFiles,
  fileIgnores: string[] = IGNORES_DEFAULT,
  maxFileSize = MAX_PAYLOAD,
  symlinksEnabled = false,
): AsyncGenerator<IFileInfo> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const cache = flatCache.load(CACHE_KEY, baseDir);

  const files = [];
  const dirs = [];

  // Split into directories and files and exclude symlinks if needed
  for (const path of paths) {
    // eslint-disable-next-line no-await-in-loop
    const fileStats = await lStat(path);
    // Check if symlink and exclude if requested
    if (fileStats.isSymbolicLink() && !symlinksEnabled) continue;

    if (fileStats.isFile() && fileStats.size <= maxFileSize) {
      files.push(path);
    } else if (fileStats.isDirectory()) {
      dirs.push(path);
    }
  }

  const globPatterns = getGlobPatterns(supportedFiles).map(p => `**/${p}`);

  // Scan folders
  for (const folder of dirs) {
    // eslint-disable-next-line no-await-in-loop
    for await (const entry of searchFiles(globPatterns, folder, maxFileSize, symlinksEnabled, fileIgnores)) {
      yield getFileInfo(entry.path, baseDir, false, cache);
    }
  }

  // Sanitize files
  if (files.length) {
    for await (const entry of searchFiles(files, baseDir, maxFileSize, symlinksEnabled, fileIgnores)) {
      if (isFileSupported(entry.path, supportedFiles)) {
        yield getFileInfo(entry.path, baseDir, false, cache);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  cache.save();
}

// export async function prepareExtendingBundle(
//   baseDir: string,
//   files: string[],
//   supportedFiles: ISupportedFiles,
//   maxFileSize = MAX_PAYLOAD,
//   symlinksEnabled = false,
//   fileIgnores: string[] = IGNORES_DEFAULT,
// ) {
//   for (const f of files) {
//   }
// }

export async function getFileInfo(
  filePath: string,
  baseDir: string,
  withContent = false,
  cache: flatCache.Cache | null = null,
): Promise<IFileInfo> {
  const fileStats = await lStat(filePath);

  const relPath = nodePath.relative(baseDir, filePath);

  const calcHash = (content: string) => {
    return crypto
      .createHash(HASH_ALGORITHM)
      .update(content)
      .digest(ENCODE_TYPE as HexBase64Latin1Encoding);
  };

  let fileContent = '';
  let fileHash = '';
  if (!withContent && !!cache) {
    // Try to get hash from cache
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const cachedData: CachedData | null = cache.getKey(relPath);
    if (cachedData) {
      if (cachedData[0] === fileStats.size && cachedData[1] === fileStats.mtimeMs) {
        // eslint-disable-next-line prefer-destructuring
        fileHash = cachedData[2];
      } else {
        // console.log(`did not match cache for: ${relPath} | ${cachedData} !== ${[fileStats.size, fileStats.mtime]}`);
      }
    }
  }

  if (!fileHash) {
    // fileContent = await readFile(filePath, 'utf8'); // causes error -24 when many files
    fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });
    fileHash = calcHash(fileContent);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    cache?.setKey(relPath, [fileStats.size, fileStats.mtimeMs, fileHash]);
  }

  const posixPath = !isWindows ? relPath : relPath.replace(/\\/g, '/');

  return {
    filePath,
    bundlePath: `/${posixPath}`,
    size: fileStats.size,
    hash: fileHash,
    content: withContent ? fileContent : undefined,
  };
}

export async function resolveBundleFiles(baseDir: string, bundleMissingFiles: string[]): Promise<IFileInfo[]> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const cache = flatCache.load('.dccache', baseDir);
  const tasks = bundleMissingFiles.map(mf => {
    const filePath = resolveBundleFilePath(baseDir, mf);
    return getFileInfo(filePath, baseDir, true, cache);
  });

  const res = await Promise.all(tasks);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  cache.save(true);
  return res;
}

export function resolveBundleFilePath(baseDir: string, bundleFilePath: string): string {
  let relPath = bundleFilePath.slice(1);

  if (isWindows) {
    relPath = relPath.replace(/\//g, '\\');
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
