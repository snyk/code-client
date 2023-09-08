import * as nodePath from 'path';
import * as fs from 'fs';
import fg from 'fast-glob';
import multimatch from 'multimatch';
import crypto from 'crypto';
import { parse as parseYaml } from 'yaml';
import union from 'lodash.union';
import util from 'util';
import { Cache } from './cache';
import {
  HASH_ALGORITHM,
  ENCODE_TYPE,
  MAX_PAYLOAD,
  MAX_FILE_SIZE,
  IGNORES_DEFAULT,
  IGNORE_FILES_NAMES,
  CACHE_KEY,
  DOTSNYK_FILENAME,
  EXCLUDED_NAMES,
} from './constants';
import { CollectBundleFilesOptions, FilePolicies } from './interfaces/analysis-options.interface';
import { SupportedFiles, FileInfo } from './interfaces/files.interface';

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

const multiMatchOptions = { matchBase: true, dot: true };
const fgOptions = {
  dot: true,
  absolute: true,
  baseNameMatch: true,
  onlyFiles: true,
  suppressErrors: true,
};

type CachedData = [number, number, string];

function filterSupportedFiles(files: string[], supportedFiles: SupportedFiles): string[] {
  const patters = getGlobPatterns(supportedFiles);
  return multimatch(files, patters, multiMatchOptions);
}

function parseIgnoreRulesToGlobs(rules: string[], baseDir: string): string[] {
  // Mappings from .gitignore format to glob format:
  // `/foo/` => `/foo/**` (meaning: Ignore root (not sub) foo dir and its paths underneath.)
  // `/foo`	=> `/foo/**`, `/foo` (meaning: Ignore root (not sub) file and dir and its paths underneath.)
  // `foo/` => `**/foo/**` (meaning: Ignore (root/sub) foo dirs and their paths underneath.)
  // `foo` => `**/foo/**`, `foo` (meaning: Ignore (root/sub) foo files and dirs and their paths underneath.)
  return rules.reduce((results: string[], rule) => {
    let prefix = '';
    if (rule.startsWith('!')) {
      // eslint-disable-next-line no-param-reassign
      rule = rule.substring(1);
      prefix = '!';
    }
    const startingSlash = rule.startsWith('/');
    const startingGlobstar = rule.startsWith('**');
    const endingSlash = rule.endsWith('/');
    const endingGlobstar = rule.endsWith('**');
    if (startingSlash || startingGlobstar) {
      // case `/foo/`, `/foo` => `{baseDir}/foo/**`
      // case `**/foo/`, `**/foo` => `{baseDir}/**/foo/**`
      if (!endingGlobstar) results.push(prefix + nodePath.posix.join(baseDir, rule, '**'));
      // case `/foo` => `{baseDir}/foo`
      // case `**/foo` => `{baseDir}/**/foo`
      // case `/foo/**` => `{baseDir}/foo/**`
      // case `**/foo/**` => `{baseDir}/**/foo/**`
      if (!endingSlash) results.push(prefix + nodePath.posix.join(baseDir, rule));
    } else {
      // case `foo/`, `foo` => `{baseDir}/**/foo/**`
      if (!endingGlobstar) results.push(prefix + nodePath.posix.join(baseDir, '**', rule, '**'));
      // case `foo` => `{baseDir}/**/foo`
      // case `foo/**` => `{baseDir}/**/foo/**`
      if (!endingSlash) results.push(prefix + nodePath.posix.join(baseDir, '**', rule));
    }
    return results;
  }, []);
}

export function parseFileIgnores(path: string): string[] {
  let rules: string[] = [];

  const dirname = nodePath.dirname(path);
  try {
    const f = fs.readFileSync(path, { encoding: 'utf8' });
    if (path.includes(DOTSNYK_FILENAME)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed: { exclude: { code?: string[]; global?: string[] } } = parseYaml(f);

      const codeIgnoredPaths = parsed.exclude.code || [];
      const globalIgnoredPaths = parsed.exclude.global || [];
      rules = [...codeIgnoredPaths, ...globalIgnoredPaths];
    } else {
      rules = f
        .split('\n')
        .map(l => l.trim())
        .filter(l => !!l && !l.startsWith('#'));
    }
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      console.log(
        `${path} is not accessible. Please check permissions and adjust .dcignore file to not even test this file`,
      );
    }
  }
  try {
    return parseIgnoreRulesToGlobs(rules, dirname);
  } catch (err) {
    console.error('Could not parse ignore rules to glob', { path });
    throw new Error('Please make sure ignore file follows correct syntax');
  }
}

export function getGlobPatterns(supportedFiles: SupportedFiles): string[] {
  return [
    ...supportedFiles.extensions.map(e => `${generateAllCaseGlobPattern(e)}`),
    ...supportedFiles.configFiles.filter(e => !EXCLUDED_NAMES.includes(e)),
  ];
}

// Generates glob patterns for case-insensitive file extension matching.
// E.g. *.[jJ][sS] for matching .js files without case-sensitivity.
function generateAllCaseGlobPattern(fileExtension: string): string {
  const chars = Array.from(fileExtension);
  if (!chars.length) {
    console.log('Invalid file extension pattern: file extension is empty.');
    return '';
  }

  if (chars[0] != '.') {
    console.log(
      "Invalid file extension pattern: missing '.' in the beginning of the file extension. Some files may not be included in the analysis.",
    );
    return '';
  }

  const caseInsensitivePatterns = chars.reduce((pattern: string[], extensionChar, i) => {
    if (i == 0) {
      // first char should always be '.', no need to generate multiple cases for file extension character
      return ['*.'];
    }

    if (extensionChar.toLowerCase() == extensionChar.toUpperCase()) {
      // Char doesn't have case variant, return as-is.
      return pattern.concat(extensionChar);
    }

    const globCharPattern = `[${extensionChar.toLowerCase()}${extensionChar.toUpperCase()}]`;
    return pattern.concat(globCharPattern);
  }, []);
  return caseInsensitivePatterns.join('');
}

/**
 * Recursively collect all exclude and ignore rules from "dirs".
 *
 * Exclude rules from .snyk files and ignore rules from .[*]ignore files are collected separately.
 * Any .[*]ignore files in paths excluded by .snyk exclude rules are ignored.
 */
export async function collectFilePolicies(
  dirs: string[],
  symlinksEnabled = false,
  fileIgnores: string[] = IGNORES_DEFAULT,
): Promise<FilePolicies> {
  const tasks = dirs.map(async folder => {
    const fileStats = await lStat(folder);
    // Check if symlink and exclude if requested
    if (!fileStats || (fileStats.isSymbolicLink() && !symlinksEnabled) || fileStats.isFile()) {
      return {
        excludes: [],
        ignores: [],
      };
    }

    // Find .snyk and .[*]ignore files inside this directory.
    const allIgnoredFiles = await fg(
      IGNORE_FILES_NAMES.map(i => `*${i}`),
      {
        ...fgOptions,
        cwd: folder,
        followSymbolicLinks: symlinksEnabled,
      },
    );

    // Parse rules from all .snyk files inside this directory.
    const snykFiles = allIgnoredFiles.filter(f => f.endsWith(DOTSNYK_FILENAME));
    const snykExcludeRules = union(...snykFiles.map(parseFileIgnores));

    // Parse rules from relevant .[*]ignore files inside this directory.
    // Exclude ignore files under paths excluded by .snyk files.
    const ignoreFiles = allIgnoredFiles.filter(
      f => !f.endsWith(DOTSNYK_FILENAME) && multimatch([nodePath.dirname(f)], snykExcludeRules).length === 0,
    );
    const ignoreFileRules = union(...ignoreFiles.map(parseFileIgnores));

    return {
      excludes: snykExcludeRules,
      ignores: ignoreFileRules,
    };
  });

  const collectedRules = await Promise.all(tasks);

  return {
    excludes: union(...collectedRules.map(policies => policies.excludes)),
    // Merge external and collected ignore rules
    ignores: union(fileIgnores, ...collectedRules.map(policies => policies.ignores)),
  };
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
  policies: FilePolicies,
): AsyncGenerator<string | Buffer> {
  const positiveIgnores = [...policies.excludes, ...policies.ignores.filter(rule => !rule.startsWith('!'))];
  const negativeIgnores = policies.ignores.filter(rule => rule.startsWith('!')).map(rule => rule.substring(1));
  // We need to use the ignore rules directly in the stream. Otherwise we would expand all the branches of the file system
  // that should be ignored, leading to performance issues (the parser would look stuck while analyzing each ignored file).
  // However, fast-glob doesn't address the negative rules in the ignore option correctly.
  // As a compromise between correctness and performance, we split the search in two streams, the first one using the
  // extension patterns as a search term and the positive ignore rules in the options, while the second that manually
  // expands those branches that should be excluded from the ignore rules throught the negative ignores as search term
  // and then matches the extensions as a second step to exclude any file that should not be analyzed.
  const positiveSearcher = fg.stream(patterns, {
    ...fgOptions,
    cwd,
    followSymbolicLinks: symlinksEnabled,
    ignore: positiveIgnores,
  });
  for await (const filePath of positiveSearcher) {
    yield filePath;
  }

  const deepPatterns = patterns.map(p => `**/${p}`);
  // TODO: This is incorrect because the .gitignore format allows to specify exceptions to previous rules, therefore
  // the separation between positive and negative ignores is incorrect in a scenario with 2+ exeptions like the one below:
  // `node_module/` <= ignores everything in a `node_module` folder and it's relative subfolders
  // `!node_module/my_module/` <= excludes the `my_module` subfolder from the ignore
  // `node_module/my_module/build/` <= re-includes the `build` subfolder in the ignore
  if (negativeIgnores.length) {
    const negativeSearcher = fg.stream(negativeIgnores, {
      ...fgOptions,
      cwd,
      followSymbolicLinks: symlinksEnabled,
      baseNameMatch: false,
      // Exclude rules should still be respected
      ignore: policies.excludes,
    });
    for await (const filePath of negativeSearcher) {
      if (isMatch(filePath.toString(), deepPatterns)) yield filePath;
    }
  }
}

/**
 * Returns bundle files from requested paths
 * If a file exceeds the maximum file size, it returns a string with its path
 * */
export async function* collectBundleFiles({
  symlinksEnabled = false,
  baseDir,
  filePolicies,
  paths,
  supportedFiles,
}: CollectBundleFilesOptions): AsyncGenerator<FileInfo | string> {
  const cache = new Cache(CACHE_KEY, baseDir);

  const files = [];
  const dirs = [];

  // Split into directories and files and exclude symlinks if needed
  for (const path of paths) {
    // eslint-disable-next-line no-await-in-loop
    const fileStats = await lStat(path);
    // Check if symlink and exclude if requested
    if (!fileStats || (fileStats.isSymbolicLink() && !symlinksEnabled)) continue;

    if (fileStats.isFile()) {
      fileStats.size <= MAX_FILE_SIZE ? files.push(path) : yield path;
    } else if (fileStats.isDirectory()) {
      dirs.push(path);
    }
  }

  // Scan folders
  const globPatterns = getGlobPatterns(supportedFiles);
  for (const folder of dirs) {
    const searcher = searchFiles(globPatterns, folder, symlinksEnabled, filePolicies);
    // eslint-disable-next-line no-await-in-loop
    for await (const filePath of searcher) {
      const fileInfo = await getFileInfo(filePath.toString(), baseDir, false, cache);
      // dc ignore AttrAccessOnNull: false positive, there is a precondition with &&
      if (fileInfo) {
        fileInfo.size <= MAX_FILE_SIZE ? yield fileInfo : yield fileInfo.bundlePath;
      }
    }
  }

  // Sanitize files
  if (files.length) {
    const searcher = searchFiles(filterSupportedFiles(files, supportedFiles), baseDir, symlinksEnabled, filePolicies);
    for await (const filePath of searcher) {
      const fileInfo = await getFileInfo(filePath.toString(), baseDir, false, cache);
      // dc ignore AttrAccessOnNull: false positive, there is a precondition with &&
      if (fileInfo) {
        fileInfo.size <= MAX_FILE_SIZE ? yield fileInfo : yield fileInfo.bundlePath;
      }
    }
  }

  cache.save();
}

export async function prepareExtendingBundle(
  baseDir: string,
  supportedFiles: SupportedFiles,
  fileIgnores: string[] = IGNORES_DEFAULT,
  files: string[],
  symlinksEnabled = false,
): Promise<{ files: FileInfo[]; removedFiles: string[] }> {
  let removedFiles: string[] = [];
  let bundleFiles: FileInfo[] = [];
  const cache = new Cache(CACHE_KEY, baseDir);

  // Filter for supported extensions/files only
  let processingFiles: string[] = filterSupportedFiles(files, supportedFiles);

  // Exclude files to be ignored based on ignore rules. We assume here, that ignore rules have not been changed.
  processingFiles = processingFiles.map(f => resolveBundleFilePath(baseDir, f)).filter(f => !isMatch(f, fileIgnores));

  if (processingFiles.length) {
    // Determine existing files (minus removed)
    if (isWindows) {
      processingFiles = processingFiles.map(f => f.replace(/\\/g, '/')); // fg requires forward-slashes in Windows globs
    }

    const entries = await fg(processingFiles, {
      ...fgOptions,
      cwd: baseDir,
      followSymbolicLinks: symlinksEnabled,
      objectMode: true,
      stats: true,
    });

    let foundFiles: Set<string> = new Set(); // This initialization is needed to help Typescript checker
    foundFiles = entries.reduce((s, e) => {
      if (e.stats && e.stats.size <= MAX_FILE_SIZE) {
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

export function getBundleFilePath(filePath: string, baseDir: string): string {
  const relPath = baseDir ? nodePath.relative(baseDir, filePath) : filePath; // relPath without explicit base makes no sense
  const posixPath = !isWindows ? relPath : relPath.replace(/\\/g, '/');
  return encodeURI(posixPath);
}

export function calcHash(content: string): string {
  return crypto.createHash(HASH_ALGORITHM).update(content).digest(ENCODE_TYPE);
}

export async function getFileInfo(
  filePath: string,
  baseDir: string,
  withContent = false,
  cache: Cache | null = null,
): Promise<FileInfo | null> {
  const fileStats = await lStat(filePath);
  if (fileStats === null) {
    return fileStats;
  }

  const bundlePath = getBundleFilePath(filePath, baseDir);

  let fileContent = '';
  let fileHash = '';
  if (!withContent && !!cache) {
    // Try to get hash from cache
    const cachedData = cache.getKey(filePath) as CachedData | null;
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

export async function resolveBundleFiles(baseDir: string, bundleMissingFiles: string[]): Promise<FileInfo[]> {
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
  let relPath = bundleFilePath;

  if (isWindows) {
    relPath = relPath.replace(/\//g, '\\');
  }

  if (baseDir) {
    return nodePath.resolve(baseDir, decodeURI(relPath));
  }

  return decodeURI(relPath);
}

// MAX_PAYLOAD / 2 is because every char takes 2 bytes in the payload
export function* composeFilePayloads(files: FileInfo[], bucketSize = MAX_PAYLOAD / 2): Generator<FileInfo[]> {
  type Bucket = {
    size: number;
    files: FileInfo[];
  };
  const buckets: Bucket[] = [{ size: bucketSize, files: [] }];

  let bucketIndex = -1;
  const getFileDataPayloadSize = (fileData: FileInfo) =>
    (fileData.content?.length ? fileData.content.length + 16 : 0) +
    fileData.bundlePath.length +
    fileData.hash.length +
    6; // constants is for the separators
  const isLowerSize = (size: number, fileData: FileInfo) => size >= getFileDataPayloadSize(fileData);
  for (const fileData of files) {
    // This file is empty or too large to send, it should be skipped.
    if (!fileData.size || !isLowerSize(bucketSize, fileData)) continue;

    // Find suitable bucket
    bucketIndex = buckets.findIndex(b => isLowerSize(b.size, fileData));

    if (bucketIndex === -1) {
      // Create a new bucket
      buckets.push({ size: bucketSize, files: [] });
      bucketIndex = buckets.length - 1;
    }

    buckets[bucketIndex].files.push(fileData);
    buckets[bucketIndex].size -= getFileDataPayloadSize(fileData);

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
  return !!multimatch([filePath], rules, { ...multiMatchOptions, matchBase: false }).length;
}
