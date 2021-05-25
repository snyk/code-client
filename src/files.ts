import * as nodePath from 'path';
import * as fs from 'fs';
import fg from '@snyk/fast-glob';
import multimatch from 'multimatch';
import crypto from 'crypto';
import union from 'lodash.union';
import util from 'util';
import { Cache } from './cache';
import { HASH_ALGORITHM, ENCODE_TYPE, MAX_PAYLOAD, IGNORES_DEFAULT, IGNORE_FILES_NAMES, CACHE_KEY } from './constants';

import { ISupportedFiles, IFileInfo } from './interfaces/files.interface';

const isWindows = nodePath.sep === '\\';

const asyncLStat = util.promisify(fs.lstat);
const lStat = async (path: fs.PathLike): Promise<fs.Stats | null> => {
  let fileStats: fs.Stats | null = null;

  try {
    // eslint-disable-next-line no-await-in-loop
    fileStats = await asyncLStat(path);
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      console.log(
        `${path} is not accessible. Please check permissions and adjust .dcignore file to not even test this file`,
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (err.code === 'ENOENT') {
      console.log(`no such file or directory: ${path}`);
    }
  }
  return fileStats;
};

export function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

const miniMatchOptions = { matchBase: true, dot: true };
const fgOptions = {
  dot: true,
  absolute: true,
  baseNameMatch: true,
  onlyFiles: true,
  suppressErrors: true,
};

type CachedData = [number, number, string];

function filterSupportedFiles(files: string[], supportedFiles: ISupportedFiles): string[] {
  const patters = getGlobPatterns(supportedFiles);
  return multimatch(files, patters, miniMatchOptions);
}

export function parseFileIgnores(path: string): string[] {
  let rules: string[] = [];

  const dirname = nodePath.dirname(path);
  try {
    const f = fs.readFileSync(path, { encoding: 'utf8' });

    rules = f
      .split('\n')
      .map(l => l.trim())
      .filter(l => !!l && !l.startsWith('#'));
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      console.log(
        `${path} is not accessible. Please check permissions and adjust .dcignore file to not even test this file`,
      );
    }
  }

  return rules.reduce((results: string[], rule) => {
    let prefix = '';
    if (rule.startsWith('!')) {
      // eslint-disable-next-line no-param-reassign
      rule = rule.substring(1);
      prefix = '!';
    }
    // Mappings from .gitignore format to glob format:
    // `/foo/` => `/foo/**` (meaning: Ignore root (not sub) foo dir and its paths underneath.)
    // `/foo`	=> `/foo/**`, `/foo` (meaning: Ignore root (not sub) file and dir and its paths underneath.)
    // `foo/` => `**/foo/**` (meaning: Ignore (root/sub) foo dirs and their paths underneath.)
    // `foo` => `**/foo/**`, `foo` (meaning: Ignore (root/sub) foo files and dirs and their paths underneath.)
    const startingSlash = rule.startsWith('/');
    const startingGlobstar = rule.startsWith('**');
    const endingSlash = rule.endsWith('/');
    const endingGlobstar = rule.endsWith('**');
    if (startingSlash || startingGlobstar) {
      if (!endingGlobstar) results.push(prefix + nodePath.posix.join(dirname, rule, '**'));
      if (!endingSlash) results.push(prefix + nodePath.posix.join(dirname, rule));
    } else {
      if (!endingGlobstar) results.push(prefix + nodePath.posix.join(dirname, '**', rule, '**'));
      if (!endingSlash) results.push(prefix + nodePath.posix.join(dirname, '**', rule));
    }
    return results;
  }, []);
}

export function getGlobPatterns(supportedFiles: ISupportedFiles): string[] {
  return [
    ...supportedFiles.extensions.map(e => `*${e}`),
    ...supportedFiles.configFiles.filter(e => !IGNORE_FILES_NAMES.includes(e)),
  ];
}

export async function collectIgnoreRules(
  dirs: string[],
  symlinksEnabled = false,
  fileIgnores: string[] = IGNORES_DEFAULT,
): Promise<string[]> {
  const tasks = dirs.map(async folder => {
    const fileStats = await lStat(folder);
    // Check if symlink and exclude if requested
    if (!fileStats || (fileStats.isSymbolicLink() && !symlinksEnabled) || fileStats.isFile()) return [];

    // Find ignore files inside this directory
    const localIgnoreFiles = await fg(
      IGNORE_FILES_NAMES.map(i => `*${i}`),
      {
        ...fgOptions,
        cwd: folder,
        followSymbolicLinks: symlinksEnabled,
      },
    );
    // Read ignore files and merge new patterns
    return union(...localIgnoreFiles.map(parseFileIgnores));
  });
  const customRules = await Promise.all(tasks);
  return union(fileIgnores, ...customRules);
}

export function determineBaseDir(paths: string[]): string {
  if (paths.length === 1) {
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
  symlinksEnabled: boolean,
  ignores: string[],
): AsyncGenerator<string | Buffer> {
  const positiveIgnores = ignores.filter(rule => !rule.startsWith('!'));
  const negativeIgnores = ignores.filter(rule => rule.startsWith('!')).map(rule => rule.substring(1));
  const searcher = fg.stream(patterns, {
    ...fgOptions,
    cwd,
    followSymbolicLinks: symlinksEnabled,
    ignore: positiveIgnores,
  });
  for await (const filePath of searcher) {
    yield filePath;
  }
  // TODO: This is incorrect because the .gitignore format allows to specify exceptions to previous rules, therefore
  // the separation between positive and negative ignores is incorrect in a scenario with 2+ exeptions like the one below:
  // `node_module/` <= ignores everything in a `node_module` folder and it's relative subfolders
  // `!node_module/my_module/` <= excludes the `my_module` subfolder from the ignore
  // `node_module/my_module/build/` <= re-includes the `build` subfolder in the ignore
  if (negativeIgnores.length) {
    const searcher2 = fg.stream(negativeIgnores, {
      ...fgOptions,
      cwd,
      followSymbolicLinks: symlinksEnabled,
      baseNameMatch: false,
    });
    for await (const filePath of searcher2) {
      if (
        isMatch(
          filePath.toString(),
          patterns.map(p => `**/${p}`),
        )
      )
        yield filePath;
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
  const cache = new Cache(CACHE_KEY, baseDir);

  const files = [];
  const dirs = [];

  // Split into directories and files and exclude symlinks if needed
  for (const path of paths) {
    // eslint-disable-next-line no-await-in-loop
    const fileStats = await lStat(path);
    // Check if symlink and exclude if requested
    if (!fileStats || (fileStats.isSymbolicLink() && !symlinksEnabled)) continue;

    if (fileStats.isFile() && fileStats.size <= maxFileSize) {
      files.push(path);
    } else if (fileStats.isDirectory()) {
      dirs.push(path);
    }
  }

  // Scan folders
  const globPatterns = getGlobPatterns(supportedFiles);
  for (const folder of dirs) {
    const searcher = searchFiles(globPatterns, folder, symlinksEnabled, fileIgnores);
    // eslint-disable-next-line no-await-in-loop
    for await (const filePath of searcher) {
      const fileInfo = await getFileInfo(filePath.toString(), baseDir, false, cache);
      if (fileInfo && fileInfo.size <= maxFileSize) {
        yield fileInfo;
      }
    }
  }

  // Sanitize files
  if (files.length) {
    const searcher = searchFiles(filterSupportedFiles(files, supportedFiles), baseDir, symlinksEnabled, fileIgnores);
    for await (const filePath of searcher) {
      const fileInfo = await getFileInfo(filePath.toString(), baseDir, false, cache);
      if (fileInfo && fileInfo.size <= maxFileSize) {
        yield fileInfo;
      }
    }
  }

  cache.save();
}

export async function prepareExtendingBundle(
  baseDir: string,
  files: string[],
  supportedFiles: ISupportedFiles,
  fileIgnores: string[] = IGNORES_DEFAULT,
  maxFileSize = MAX_PAYLOAD,
  symlinksEnabled = false,
): Promise<{ files: IFileInfo[]; removedFiles: string[] }> {
  let removedFiles: string[] = [];
  let bundleFiles: IFileInfo[] = [];
  const cache = new Cache(CACHE_KEY, baseDir);

  // Filter for supported extensions/files only
  let processingFiles: string[] = filterSupportedFiles(files, supportedFiles);

  // Exclude files to be ignored based on ignore rules. We assume here, that ignore rules have not been changed.
  processingFiles = processingFiles.filter(f => !isMatch(f, fileIgnores));

  if (processingFiles.length) {
    // Determine existing files (minus removed)
    const entries = await fg(processingFiles, {
      ...fgOptions,
      cwd: baseDir,
      followSymbolicLinks: symlinksEnabled,
      objectMode: true,
      stats: true,
    });

    let foundFiles: Set<string> = new Set(); // This initialization is needed to help Typescript checker
    foundFiles = entries.reduce((s, e) => {
      if (e.stats && e.stats.size <= maxFileSize) {
        s.add(e.path);
      }
      return s;
    }, foundFiles);

    removedFiles = processingFiles.reduce((s, p) => {
      if (!foundFiles.has(p)) {
        s.push(getBundleFilePath(p, baseDir));
      }
      return s;
    }, [] as string[]);

    if (foundFiles.size) {
      bundleFiles = (
        await Promise.all([...foundFiles].map((p: string) => getFileInfo(p, baseDir, false, cache)))
      ).filter(notEmpty);
    }
  }

  return {
    files: bundleFiles,
    removedFiles,
  };
}

function getBundleFilePath(filePath: string, baseDir: string) {
  const relPath = nodePath.relative(baseDir, filePath);
  const posixPath = !isWindows ? relPath : relPath.replace(/\\/g, '/');
  return encodeURI(`/${posixPath}`);
}

export async function getFileInfo(
  filePath: string,
  baseDir: string,
  withContent = false,
  cache: Cache | null = null,
): Promise<IFileInfo | null> {
  const fileStats = await lStat(filePath);
  if (fileStats === null) {
    return fileStats;
  }

  const bundlePath = getBundleFilePath(filePath, baseDir);

  const calcHash = (content: string) => {
    return crypto.createHash(HASH_ALGORITHM).update(content).digest(ENCODE_TYPE);
  };

  let fileContent = '';
  let fileHash = '';
  if (!withContent && !!cache) {
    // Try to get hash from cache
    const cachedData: CachedData | null = cache.getKey(filePath);
    if (cachedData) {
      if (cachedData[0] === fileStats.size && cachedData[1] === fileStats.mtimeMs) {
        fileHash = cachedData[2];
      } else {
        // console.log(`did not match cache for: ${filePath} | ${cachedData} !== ${[fileStats.size, fileStats.mtime]}`);
      }
    }
  }

  if (!fileHash) {
    try {
      fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });
      fileHash = calcHash(fileContent);
      cache?.setKey(filePath, [fileStats.size, fileStats.mtimeMs, fileHash]);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (err.code === 'EACCES' || err.code === 'EPERM') {
        console.log(
          `${filePath} is not accessible. Please check permissions and adjust .dcignore file to not even test this file`,
        );
      }
    }
  }

  return {
    filePath,
    bundlePath,
    size: fileStats.size,
    hash: fileHash,
    content: withContent ? fileContent : undefined,
  };
}

export async function resolveBundleFiles(baseDir: string, bundleMissingFiles: string[]): Promise<IFileInfo[]> {
  const cache = new Cache('.dccache', baseDir);
  const tasks = bundleMissingFiles.map(mf => {
    const filePath = resolveBundleFilePath(baseDir, mf);
    return getFileInfo(filePath, baseDir, true, cache);
  });

  const res = (await Promise.all(tasks)).filter(notEmpty);
  cache.save(true);
  return res;
}

export function resolveBundleFilePath(baseDir: string, bundleFilePath: string): string {
  let relPath = bundleFilePath.slice(1);

  if (isWindows) {
    relPath = relPath.replace(/\//g, '\\');
  }

  return nodePath.resolve(baseDir, decodeURI(relPath));
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

export function isMatch(filePath: string, rules: string[]): boolean {
  return !!multimatch([filePath], rules, { ...miniMatchOptions, matchBase: false }).length;
}
