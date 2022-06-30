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
  setBase64Encoding,
} from '../src/http';
import { BundleFiles } from '../src/interfaces/files.interface';
import * as needle from '../src/needle';
import { gunzipSync } from 'zlib';

const fakeBundleHash = '0aafac4a1a3daccf80ea53b0e6a946cd9b4d9d2dfb1fc13b5ca3e16b045744b8';
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
    expect(new Set(response.value.configFiles)).toEqual(new Set(['.dcignore', '.gitignore']));
    expect(new Set(response.value.extensions)).toEqual(
      new Set([
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
        base64Encoding: false,
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
        base64Encoding: false,
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
        base64Encoding: false,
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
          base64Encoding: false,
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
        base64Encoding: false,
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
        base64Encoding: false,
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
        base64Encoding: false,
      });
      expect(response.type).toEqual('success');
      if (response.type !== 'success') return; // TS trick
      expect(response.value.bundleHash).toContain('06c8969ce7bce4c62e28f96cf9fc54a68cf25644aebd53be09094f365058f4a6');
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
        base64Encoding: false,
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
        base64Encoding: false,
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
        base64Encoding: false,
      });
      expect(response.type).toEqual('success');
      if (response.type === 'error') return;
      expect(response.value.status !== AnalysisStatus.failed).toBeTruthy();

      if (response.value.status === AnalysisStatus.complete && response.value.type === 'sarif') {
        expect(response.value.sarif.runs[0].results).toHaveLength(17);

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
          base64Encoding: false,
        });

        expect(response.type).toEqual('success');
        if (response.type === 'error') return;
        expect(response.value.status !== AnalysisStatus.failed).toBeTruthy();
      } while (response.value.status !== AnalysisStatus.complete);

      expect(response.value.type === 'sarif').toBeTruthy();
      if (response.value.type !== 'sarif') return;

      expect(response.value.sarif.runs[0].results).toHaveLength(12);

      // Get analysis results with severity 3
      do {
        response = await getAnalysis({
          baseURL,
          sessionToken,
          bundleHash: realBundleHashFull,
          severity: 3,
          source,
          base64Encoding: false,
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
});

describe('Base64 encoded operations', () => {
  it('encodes a payload to base64', async () => {
    // Create a bundle
    const files: BundleFiles = (await singleBundleFull).reduce((r, d) => {
      r[d.bundlePath] = pick(d, ['hash', 'content']);
      return r;
    }, {});
    const makeRequestSpy = jest.spyOn(needle, 'makeRequest');

    const bundleResponse = await createBundle({
      baseURL,
      sessionToken,
      source,
      files,
      base64Encoding: true,
    });

    const request = makeRequestSpy.mock.calls[0][0];
    const requestBody = request.body as string;
    const requestHeaders = request.headers;
    expect(requestHeaders!['content-type']).toEqual('application/octet-stream');
    expect(requestHeaders!['content-encoding']).toEqual('gzip');
    const decompressedBody = gunzipSync(Buffer.from(requestBody)).toString();
    expect(request.isJson).toBe(false);
    expect(JSON.parse(Buffer.from(decompressedBody, 'base64').toString())).toEqual(files);
  }),
    it('extends a base64-encoded bundle', async () => {
      const makeRequestSpy = jest.spyOn(needle, 'makeRequest');
      const bundleResponse = await extendBundle({
        baseURL,
        sessionToken,
        source,
        bundleHash: fakeBundleHashFull,
        files: {
          'new.js': 'new123',
        },
        removedFiles: [
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
        base64Encoding: true,
      });
      const request = makeRequestSpy.mock.calls[0][0];
      const requestBody = request.body as string;
      const requestHeaders = request.headers;
      expect(requestHeaders!['content-type']).toEqual('application/octet-stream');
      expect(requestHeaders!['content-encoding']).toEqual('gzip');
      const decompressedBody = gunzipSync(Buffer.from(requestBody)).toString();
      expect(request.isJson).toBe(false);
      expect(JSON.parse(Buffer.from(decompressedBody, 'base64').toString())).toEqual({
        files: {
          'new.js': 'new123',
        },
        removedFiles: [
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
    });

  describe('it auto-sets base64 encoding if needed', () => {
    expect(setBase64Encoding({ baseURL, sessionToken, source, base64Encoding: false })).toBe(false);
    expect(setBase64Encoding({ baseURL, sessionToken, source, base64Encoding: true })).toBe(true);
    expect(
      setBase64Encoding({ baseURL: 'https://deeproxy.dev.eu.snyk.io', sessionToken, source, base64Encoding: false }),
    ).toBe(true);
    expect(
      setBase64Encoding({ baseURL: 'https://deeproxy.snyk.io', sessionToken, source, base64Encoding: false }),
    ).toBe(false);
  });
});
