import pick from 'lodash.pick';

import { baseURL, sessionToken, source, TEST_TIMEOUT } from './constants/base';
import { bundleFiles, bundleFilesFull, singleBundleFull } from './constants/sample';
import {
  getFilters,
  createBundle,
  checkBundle,
  extendBundle,
  getAnalysis,
  AnalysisStatus,
  initReport,
} from '../src/http';
import { BundleFiles } from '../src/interfaces/files.interface';
import * as needle from '../src/needle';
import { gunzipSync } from 'zlib';

const fakeBundleHash = 'd9f1171fb6f6bf12eb217fee43eef3cebd6a85cc78bc333035bf4cc3ebf1cf68';
let fakeBundleHashFull = '';
const realBundleHash = '';
let realBundleHashFull = '';

const fakeMissingFiles = [
  'AnnotatorTest.cpp',
  'GitHubAccessTokenScrambler12.java',
  'app.js',
  'db.js',
  'main.js',
  'big-file.js',
  'routes/index.js',
  'routes/sharks.js',
  // TODO: This should be ignored
  'not/ignored/this_should_be_ignored.jsx',
  'not/ignored/this_should_not_be_ignored.java',
];

describe('Requests to public API', () => {
  it('gets filters successfully', async () => {
    const response = await getFilters(baseURL, '');
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(new Set(response.value.configFiles)).toEqual(new Set(['.dcignore', '.gitignore', '.snyk']));
    expect(response.value.extensions).toEqual(
      expect.arrayContaining([
        '.cs',
        '.c',
        '.cc',
        '.cjs',
        '.cls',
        '.config',
        '.cpp',
        '.cs',
        '.cxx',
        '.ejs',
        '.erb',
        '.es',
        '.es6',
        '.go',
        '.h',
        '.haml',
        '.hpp',
        '.htm',
        '.html',
        '.hxx',
        '.java',
        '.js',
        '.jsp',
        '.jspx',
        '.jsx',
        '.kt',
        '.mjs',
        '.php',
        '.phtml',
        '.pom',
        '.py',
        '.rb',
        '.rhtml',
        '.scala',
        '.slim',
        '.swift',
        '.ts',
        '.tsx',
        '.vb',
        '.vue',
        '.wxs',
        '.xml',
        '.xsd',
        '.aspx',
        '.ejs',
      ]),
    );

    expect(response.value.configFiles.length).toBeGreaterThan(0);
    expect(response.value.extensions.length).toBeGreaterThan(0);
  });

  it('test network issues', async () => {
    const response = await getFilters('https://faketest.snyk.io', 'test-source', 1);
    expect(response.type).toEqual('error');
    if (response.type !== 'error') return;
    expect(response.error).toMatchObject({
      apiName: 'filters',
      statusCode: 452,
      statusText: '[Connection issue] Could not resolve domain',
    });
  });

  it(
    'creates bundle successfully',
    async () => {
      const files: BundleFiles = [...(await bundleFiles).entries()].reduce((obj, [i, d]) => {
        obj[d.bundlePath] = `${i}`;
        return obj;
      }, {});

      const response = await createBundle({
        baseURL,
        sessionToken,
        files,
        source,
      });
      expect(response.type).toEqual('success');
      if (response.type === 'error') {
        console.error(response);
        return;
      }
      expect(response.value.bundleHash).toContain(fakeBundleHash);
      fakeBundleHashFull = response.value.bundleHash;
      expect(response.value.missingFiles).toEqual(fakeMissingFiles);
    },
    TEST_TIMEOUT,
  );

  it(
    'checks bundle successfully',
    async () => {
      const response = await checkBundle({
        baseURL,
        sessionToken,
        source,
        bundleHash: fakeBundleHashFull,
      });
      expect(response.type).toEqual('success');
      if (response.type === 'error') return;
      expect(response.value.bundleHash).toEqual(fakeBundleHashFull);
      expect(response.value.missingFiles).toEqual(fakeMissingFiles);
    },
    TEST_TIMEOUT,
  );

  it(
    'checks expired bundle successfully',
    async () => {
      const response = await checkBundle({
        baseURL,
        sessionToken,
        source,
        bundleHash: 'mock-expired-bundle-id',
      });
      expect(response.type).toEqual('error');
      // dummy to cheat typescript compiler
      if (response.type == 'success') return;
      expect(response.error.statusCode).toEqual(404);
      expect(response.error.statusText).toEqual('Uploaded bundle has expired');
    },
    TEST_TIMEOUT,
  );

  it(
    'request analysis with missing files',
    async () => {
      let response;
      do {
        response = await getAnalysis({
          baseURL,
          sessionToken,
          bundleHash: fakeBundleHashFull,
          severity: 1,
          source,
        });
      } while (response.type === 'success');

      expect(response.type).toEqual('error');
      expect(response.error).toEqual({
        apiName: 'getAnalysis',
        statusCode: 404,
        statusText: 'Not found',
      });
    },
    TEST_TIMEOUT,
  );

  it(
    'extends bundle successfully',
    async () => {
      const response = await extendBundle({
        baseURL,
        sessionToken,
        source,
        bundleHash: fakeBundleHashFull,
        files: {
          'new.js': 'new123',
        },
        removedFiles: [
          '.eslintrc.json',
          '.snyk',
          `AnnotatorTest.cpp`,
          `app.js`,
          `GitHubAccessTokenScrambler12.java`,
          `db.js`,
          `main.js`,
          'big-file.js',
          `not/ignored/this_should_be_ignored.jsx`,
          `not/ignored/this_should_not_be_ignored.java`,
          `routes/index.js`,
          `routes/sharks.js`,
        ],
      });
      expect(response.type).toEqual('success');
      if (response.type === 'error') return;
      expect(response.value.bundleHash).toContain('1484a1a5cf09854080e7be7ed023fd085287d5cf71d046aed47d2c03de1190c6');
      expect(response.value.missingFiles).toEqual([`new.js`]);
    },
    TEST_TIMEOUT,
  );

  it(
    'extends expired bundle and fails',
    async () => {
      const response = await extendBundle({
        baseURL,
        sessionToken,
        source,
        bundleHash: 'wrong-bundle-id-2',
        files: {
          'new2.js': 'new1234',
        },
      });

      expect(response.type).toEqual('error');
      if (response.type !== 'error') return;
      expect(response.error).toEqual({
        apiName: 'extendBundle',
        statusCode: 404,
        statusText: 'Parent bundle has expired',
      });
    },
    TEST_TIMEOUT,
  );

  it(
    'uploads fake files to fake bundle',
    async () => {
      const response = await extendBundle({
        baseURL,
        sessionToken,
        source,
        bundleHash: fakeBundleHashFull,
        files: {
          'df.js': { hash: 'df', content: 'const module = new Module();' },
          'sdfs.js': { hash: 'sdfs', content: 'const App = new App();' },
        },
      });
      expect(response.type).toEqual('success');
      if (response.type !== 'success') return; // TS trick
      expect(response.value.bundleHash).toContain('0124f75771f3d782d370ea2fedf87d2af434c40d740a10e9a5980633ce3b704d');
      expect(response.value.missingFiles).toHaveLength(12);
    },
    TEST_TIMEOUT,
  );

  it(
    'test successful workflow',
    async () => {
      // Create a bundle first
      const files: BundleFiles = (await bundleFilesFull).reduce((r, d) => {
        r[d.bundlePath] = pick(d, ['hash', 'content']);
        return r;
      }, {});

      const bundleResponse = await createBundle({
        baseURL,
        sessionToken,
        source,
        files,
      });
      expect(bundleResponse.type).toEqual('success');
      if (bundleResponse.type === 'error') return;
      expect(bundleResponse.value.bundleHash).toContain(realBundleHash);
      realBundleHashFull = bundleResponse.value.bundleHash;

      // Check missing files
      expect(bundleResponse.value.missingFiles).toEqual([]);

      // Check missing files with separate API call
      const checkResponse = await checkBundle({
        baseURL,
        sessionToken,
        source,
        bundleHash: realBundleHashFull,
      });
      expect(checkResponse.type).toEqual('success');
      if (checkResponse.type === 'error') return;
      expect(checkResponse.value.bundleHash).toEqual(realBundleHashFull);
      expect(checkResponse.value.missingFiles).toEqual([]);

      // Get analysis results
      let response = await getAnalysis({
        baseURL,
        sessionToken,
        source,
        bundleHash: realBundleHashFull,
        severity: 1,
      });
      expect(response.type).toEqual('success');
      if (response.type === 'error') return;
      expect(response.value.status !== AnalysisStatus.failed).toBeTruthy();

      if (response.value.status === AnalysisStatus.complete && response.value.type === 'sarif') {
        expect(response.value.sarif.runs[0].results?.length).toBeGreaterThan(0);

        expect(new Set(response.value.coverage)).toEqual(
          new Set([
            {
              files: 2,
              isSupported: true,
              lang: 'Java',
            },
            {
              files: 1,
              isSupported: true,
              lang: 'C++ (beta)',
            },
            {
              files: 7,
              isSupported: true,
              lang: 'JavaScript',
            },
          ]),
        );
      }

      // Get analysis results limited to 1 file
      do {
        response = await getAnalysis({
          baseURL,
          sessionToken,
          bundleHash: realBundleHashFull,
          severity: 1,
          limitToFiles: [`GitHubAccessTokenScrambler12.java`],
          source,
        });

        expect(response.type).toEqual('success');
        if (response.type === 'error') return;
        expect(response.value.status !== AnalysisStatus.failed).toBeTruthy();
      } while (response.value.status !== AnalysisStatus.complete);

      expect(response.value.type === 'sarif').toBeTruthy();
      if (response.value.type !== 'sarif') return;

      expect(response.value.sarif.runs[0].results?.length).toBeGreaterThan(0);

      // Get analysis results with severity 3
      do {
        response = await getAnalysis({
          baseURL,
          sessionToken,
          bundleHash: realBundleHashFull,
          severity: 3,
          source,
        });
        expect(response.type).toEqual('success');
        if (response.type === 'error') return;
        expect(response.value.status !== AnalysisStatus.failed).toBeTruthy();
      } while (response.value.status !== AnalysisStatus.complete);

      expect(response.value.type === 'sarif').toBeTruthy();
      if (response.value.type !== 'sarif') return;

      expect(response.value.sarif.runs[0].results).toHaveLength(4);
    },
    TEST_TIMEOUT,
  );

  // TODO: this test is being skipped for now since the /report flow hasn't been fully rolled out and it can't succeed for now
  it.skip('test successful report workflow', async () => {
    // Create a bundle first
    const files: BundleFiles = (await bundleFilesFull).reduce((r, d) => {
      r[d.bundlePath] = pick(d, ['hash', 'content']);
      return r;
    }, {});

    const bundleResponse = await createBundle({
      baseURL,
      sessionToken,
      source,
      files,
    });
    expect(bundleResponse.type).toEqual('success');
    if (bundleResponse.type === 'error') return;
    const bundleHash = bundleResponse.value.bundleHash;

    const initReportResponse = await initReport({
      baseURL,
      sessionToken,
      source,
      bundleHash: bundleHash,
      report: {
        enabled: true,
        projectName: 'test-project',
      },
    });

    expect(initReportResponse.type).toEqual('success');

    // TODO: getReport with reportId
    // example options:
    // {
    //   baseURL: 'http://localhost:11981',
    //   sessionToken: 'token 2bee9fd5-f9b6-48d7-a159-300216f99af4',
    //   source: 'snyk-cli',
    //   requestId: 'a00a3aba-eba4-4e17-ad0b-0cd7bf0cbd5c',
    //   reportId: '004355be-5424-4a2c-ad53-44841a83e185'
    // }

    if (initReportResponse.type === 'error') return;
    console.log(initReportResponse.value);
  });
});
