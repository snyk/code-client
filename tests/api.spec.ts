import pick from 'lodash.pick';

import { baseURL, sessionToken, source, TEST_TIMEOUT } from './constants/base';
import { bundleFiles, bundleFilesFull } from './constants/sample';
import { fromEntries } from '../src/lib/utils';
import { getFilters, createBundle, checkBundle, extendBundle, getAnalysis, AnalysisStatus } from '../src/http';
import { BundleFiles } from '../src/interfaces/files.interface';

const fakeBundleHash = 'c58d69bd4fd65c45b1112bd7b45f028e614d443fc123901fd1aba15856c13c27';
let fakeBundleHashFull = '';
const realBundleHash = 'c3a31c6c503b76ce51e2f8f7db9aa8f26715e6367124ce6e2f419087cad011b0';
let realBundleHashFull = '';

const fakeMissingFiles = [
  'AnnotatorTest.cpp',
  'GitHubAccessTokenScrambler12.java',
  'app.js',
  'db.js',
  'main.js',
  // TODO: This should be ignored
  'not/ignored/this_should_be_ignored.jsx',
  'not/ignored/this_should_not_be_ignored.java',
  'routes/index.js',
  'routes/sharks.js',
];

describe('Requests to public API', () => {
  it('gets filters successfully', async () => {
    const response = await getFilters(baseURL, '');
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(new Set(response.value.configFiles)).toEqual(new Set(['.dcignore', '.gitignore']));
    expect(new Set(response.value.extensions)).toEqual(
      new Set([
        '.CS',
        '.Cs',
        '.c',
        '.cc',
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
        '.php',
        '.py',
	      '.rb',
        '.rhtml',
        '.slim',
        '.ts',
        '.tsx',
        '.vue',
        '.ASPX',
        '.Aspx',
        '.aspx',
        '.ejs',
      ]),
    );

    expect(response.value.configFiles.length).toBeGreaterThan(0);
    expect(response.value.extensions.length).toBeGreaterThan(0);
  });

  it(
    'creates bundle successfully',
    async () => {
      const files: BundleFiles = fromEntries(
        [...(await bundleFiles).entries()].map(([i, d]) => [d.bundlePath, `${i}`]),
      );

      const response = await createBundle({
        baseURL,
        sessionToken,
        files,
        source: 'atom',
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
          source: 'atom',
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
          `not/ignored/this_should_be_ignored.jsx`,
          `not/ignored/this_should_not_be_ignored.java`,
          `routes/index.js`,
          `routes/sharks.js`,
        ],
      });
      expect(response.type).toEqual('success');
      if (response.type === 'error') return;
      expect(response.value.bundleHash).toContain('587a6bcb0095606ad57ccc7bb7ac6401475ce4181c13f7136491a16df06544f1');
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
        apiName: "extendBundle",
        statusCode: 404,
        statusText: "Parent bundle has expired"
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
      expect(response.value.bundleHash).toContain('5bdbdda45cf74752fee89c78558bc8b7b3f09582edf66bbaf206d0b530c15ed8');
      expect(response.value.missingFiles).toHaveLength(11);
    },
    TEST_TIMEOUT,
  );

  it('test successful workflow', async () => {
      // Create a bundle first
      const files: BundleFiles = (await bundleFilesFull).reduce((r, d) => {
        r[d.bundlePath] = pick(d, ['hash', 'content']);
        return r;
      }, {});

      const bundleResponse = await createBundle({
        baseURL,
        sessionToken,
        files,
        source: 'atom',
      });
      expect(bundleResponse.type).toEqual('success');
      if (bundleResponse.type === 'error') return;
      expect(bundleResponse.value.bundleHash).toContain(realBundleHash);
      realBundleHashFull = bundleResponse.value.bundleHash;

      // Check missing files
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
        bundleHash: realBundleHashFull,
        severity: 1,
        source: 'atom',
      });
      expect(response.type).toEqual('success');
      if (response.type === 'error') return;
      expect(response.value.status !== AnalysisStatus.failed).toBeTruthy();

      if (response.value.status === AnalysisStatus.complete && response.value.type === 'sarif' ) {
        expect(response.value.sarif.runs[0].results).toHaveLength(12);

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
              files: 5,
              isSupported: true,
              lang: 'JavaScript',
            },
            {
              files: 1,
              isSupported: true,
              lang: 'JSX',
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
          source: 'atom',
        });

        expect(response.type).toEqual('success');
        if (response.type === 'error') return;
        expect(response.value.status !== AnalysisStatus.failed).toBeTruthy();
      } while (response.value.status !== AnalysisStatus.complete);

      expect(response.value.type === 'sarif').toBeTruthy();
      if (response.value.type !== 'sarif') return;

      expect(response.value.sarif.runs[0].results).toHaveLength(8);

      // Get analysis results with severity 3
      do {
        response = await getAnalysis({
          baseURL,
          sessionToken,
          bundleHash: realBundleHashFull,
          severity: 3,
          source: 'atom',
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
