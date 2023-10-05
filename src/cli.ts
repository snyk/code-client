/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Command } from 'commander';

import {
  getSupportedFiles,
  CreateBundleFromFoldersOptions,
  createBundleWithCustomFiles,
  createBundleFromFolders,
  FileBundle,
} from './bundles';
import { analyzeBundle } from './analysis';
import { ConnectionOptions, checkBundle, AnalysisResponseProgress } from './http';
import { emitter } from './emitter';

function parseConnectionOptions(options: {
  url: string;
  token: string;
  source: string;
  org?: string;
  orgId?: string;
  headers?: string[];
}): ConnectionOptions {
  let headers: { [key: string]: string } = {};
  if (options.headers?.length) {
    headers = options.headers.reduce((m, h) => {
      const [key, value] = h.split(':');
      m[key.trim()] = value.trim();
      return m;
    }, {});
  }
  return {
    baseURL: options.url,
    sessionToken: options.token,
    source: options.source,
    ...(options.org ? { org: options.org } : {}),
    ...(options.orgId ? { orgId: options.orgId } : {}),
    extraHeaders: headers,
    // requestId?: string; - not supported
  };
}

async function filtersAction(options: { url: string; token: string; source: string; org?: string; orgId?: string }) {
  const response = await getSupportedFiles(options.url, options.source, undefined, [], options.orgId);
  console.log(JSON.stringify(response, null, 2));
}

async function createBundleAction(options: {
  url: string;
  token: string;
  source: string;
  org?: string;
  headers?: string[];
  debug?: boolean;
  ignore?: string[];
  patterns?: string[];
  path: string[];
}) {
  const opts: CreateBundleFromFoldersOptions = {
    ...parseConnectionOptions(options),
    paths: options.path,
    ...(options.ignore?.length ? { defaultFileIgnores: options.ignore } : {}),
  };
  let bundle: FileBundle | null = null;
  if (options.patterns?.length) {
    bundle = await createBundleWithCustomFiles(opts, { configFiles: [], extensions: options.patterns ?? [] });
  } else {
    bundle = await createBundleFromFolders(opts);
  }
  if (bundle === null) {
    process.exitCode = 1;
  }

  if (options.debug) {
    console.log(JSON.stringify(bundle, null, 2));
  } else {
    console.log(bundle?.bundleHash);
  }
}

async function readBundleAction(
  bundleHash: string,
  options: { url: string; token: string; source: string; org?: string; orgId?: string },
) {
  const opts = {
    ...parseConnectionOptions(options),
    bundleHash,
  };

  const bundle = await checkBundle(opts);
  if (bundle.type === 'error') {
    process.exitCode = 1;
  }
  console.log(JSON.stringify(bundle, null, 2));
}

async function analysisBundleAction(
  bundleHash: string,
  options: { url: string; token: string; source: string; org?: string; orgId?: string },
) {
  const opts = {
    ...parseConnectionOptions(options),
    bundleHash,
  };

  const bundle = await analyzeBundle(opts);
  console.log(JSON.stringify(bundle, null, 2));
}

function enhanceCommonOptions(command: Command): Command {
  return command
    .requiredOption('--url <url>', 'service URL')
    .requiredOption('--token <hash>', 'user token')
    .option('--org <string>', 'organization')
    .option('--source <string>', 'source identifier', 'code-client')
    .option(
      '-H, --headers [string...]',
      'custom headers e.g. "X-Custom-Header: some value". Can have multiple values diveded by space',
    )
    .option('--debug', 'enable debug mode');
}

const program = new Command();

program.name('CLI').version('0.1.0').description('Code Client API');

const filtersCommand = new Command('filters').description('get supported file filters').action(filtersAction);

program.addCommand(enhanceCommonOptions(filtersCommand));

const createCommand = new Command('bundle:create')
  .description('create a new bundle and return its ID with meta info')
  .option('--patterns [string...]', 'supported file patterns')
  .option('--ignore [path...]', 'ignored path glob')
  .requiredOption('--path [path...]', 'source code dir')
  .action(createBundleAction);

program.addCommand(enhanceCommonOptions(createCommand));

const checkCommand = new Command('bundle:check')
  .description('read existing bundle and return its ID with meta info')
  .argument('<bundleId>', 'bundle identifier')
  .action(readBundleAction);

program.addCommand(enhanceCommonOptions(checkCommand));

const analysisCommand = new Command('analysis:bundle')
  .description('run analysis for existing bundle')
  .argument('<bundleId>', 'bundle identifier')
  .action(analysisBundleAction);

program.addCommand(enhanceCommonOptions(analysisCommand));

/** Bundle upload process is started with provided data */
emitter.on('uploadBundleProgress', (processed: number, total: number) => {
  console.log(`Upload bundle progress: ${processed}/${total}`);
});

emitter.on('analyseProgress', (data: AnalysisResponseProgress) => {
  console.log(`${data.status} : ${data.progress * 100}%`);
});

// emitter.on('apiRequestLog', (message: string) => {
//   console.log(message);
// });

async function main(): Promise<void> {
  await program.parseAsync(process.argv);
}

main().catch(err => {
  console.error(err);
});
