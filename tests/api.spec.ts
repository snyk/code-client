import { baseURL, authHost, sessionToken, TEST_TIMEOUT } from './constants/base';
import { bundleFiles, bundleFilesFull, bundleFilePaths } from './constants/sample';
import { fromEntries } from '../src/lib/utils';
import pick from 'lodash.pick';
import {
  getFilters,
  startSession,
  checkSession,
  createBundle,
  checkBundle,
  extendBundle,
  getAnalysis,
  AnalysisStatus,
} from '../src/http';
import { BundleFiles } from '../src/interfaces/files.interface';

const fakeBundleHash = 'fe72b6d08bbbc36214992aa769a9e3ee2a52579f88e1212cbb0719d63da6e14c';
let fakeBundleHashFull = '';
const realBundleHash = '26635e09233a4c221b2d0f3f118f92e0b48bbdcbbbcde8e3d0d34d1eacb44b37';
let realBundleHashFull = '';

const fakeMissingFiles = [
  '/AnnotatorTest.cpp',
  '/GitHubAccessTokenScrambler12.java',
  '/app.js',
  '/db.js',
  '/main.js',
  // TODO: This should be ignored
  '/not/ignored/this_should_be_ignored.jsx',
  '/not/ignored/this_should_not_be_ignored.java',
  '/routes/index.js',
  '/routes/sharks.js',
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
        '.es',
        '.es6',
        '.h',
        '.hpp',
        '.htm',
        '.html',
        '.hxx',
        '.java',
        '.js',
        '.jsx',
        '.php',
        '.py',
        '.ts',
        '.tsx',
        '.vue',
      ]),
    );

    expect(response.value.configFiles.length).toBeGreaterThan(0);
    expect(response.value.extensions.length).toBeGreaterThan(0);
  });

  it('starts session successfully', async () => {
    const startSessionResponse = startSession({
      source: 'atom',
      authHost,
    });
    expect(startSessionResponse.loginURL).toMatch(/.*\/login\?token=.*&utm_source=atom/);
    const draftToken = startSessionResponse.draftToken;

    // This token is just a draft and not ready to be used permanently
    const checkSessionResponse = await checkSession({ authHost, draftToken });
    expect(checkSessionResponse.type).toEqual('success');
    if (checkSessionResponse.type == 'error') return;
    expect(checkSessionResponse.value).toEqual('');
  });

  it('checks session unsuccessfully', async () => {
    const response = await checkSession({
      authHost,
      draftToken: 'dummy-token',
    });
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value).toEqual('');
  });

  // TODO: find a way to test successfull workflow automatically
  // it('checks session successfully', async () => {
  //   const response = await checkSession({
  //     authHost,
  //     sessionToken,
  //   });
  //   expect(response.type).toEqual('success');
  //   if (response.type === 'error') return;
  //   expect(response.value).toEqual(true);
  // });

  it(
    'creates bundle successfully',
    async () => {

      const files: BundleFiles = fromEntries([...(await bundleFiles).entries()].map(([i, d]) => [d.bundlePath, `${i}`]));

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
        bundleHash: fakeBundleHashFull,
        files: {
          '/new.js': 'new123',
        },
        removedFiles: [
          `/AnnotatorTest.cpp`,
          `/app.js`,
          `/GitHubAccessTokenScrambler12.java`,
          `/db.js`,
          `/main.js`,
          `/not/ignored/this_should_be_ignored.jsx`,
          `/not/ignored/this_should_not_be_ignored.java`,
          `/routes/index.js`,
          `/routes/sharks.js`,
        ],
      });
      expect(response.type).toEqual('success');
      if (response.type === 'error') return;
      expect(response.value.bundleHash).toContain('f497974a35b2b146bf35c259186027d71fdecdeb319567e46255090edca06675');
      expect(response.value.missingFiles).toEqual([`/new.js`]);
    },
    TEST_TIMEOUT,
  );

  it(
    'extends expired bundle successfully',
    async () => {
      const response = await extendBundle({
        baseURL,
        sessionToken,
        bundleHash: 'wrong-bundle-id-2',
        files: {
          '/new2.js': 'new1234',
        },
      });

      expect(response.type).toEqual('success');
      if (response.type === 'error') return;
      expect(response.value.bundleHash).toContain('5979992527b34d10f9d772abcc0d6a07c70db08b4850b1c99ee6879f14d13f22');
      expect(response.value.missingFiles).toEqual([`/new2.js`]);
    },
    TEST_TIMEOUT,
  );

  it(
    'uploads fake files to fake bundle',
    async () => {
      const response = await extendBundle({
        baseURL,
        sessionToken,
        bundleHash: fakeBundleHashFull,
        files: {
          'df.js': { hash: 'df', content: 'const module = new Module();'},
          'sdfs.js': { hash: 'sdfs', content: 'const App = new App();'},
        },
      });
      expect(response.type).toEqual('success');
      if (response.type !== 'success') return; // TS trick
      expect(response.value.bundleHash).toContain('9ef5c6239fc95b9dc4e9defb9550dee534580cc990cee773f0c504688e86cac8');
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

      if (response.value.status === AnalysisStatus.complete) {

        const suggestions = response.value.sarif.runs[0].results!;
        expect(suggestions).toHaveLength(12);
        if (suggestions.length < 1) return; // TS trick

        const suggestion = suggestions[0];
        expect(suggestion).toMatchObject({
          ruleId: 'cpp/MissingOpenCheckOnFile/test',
          level: 'note',
          fingerprints: {
            '0': '3e40a81739245db8fff4903a7e28e08bffa03486a677e7c91594cfdf15fb5a1d',
            '1': '57664a44.2c254dac.98501263.9e345555.da547a36.9509b717.a713c1c8.45d76bdf.4a7ae834.2c254dac.98501263.9e345555.da547a36.9509b717.a713c1c8.45d76bdf'
          },
          message: {
            "text": "Missing check is_open on {0} before {1}.",
            "markdown": "Missing check is_open on std::fstream before writing to it.",
            "arguments": [
              "[std::fstream](0)",
              "[writing to it](1)",
            ]
          }
        });

        expect(suggestion.codeFlows![0].threadFlows[0].locations).toHaveLength(2);

        expect(new Set(response.value.coverage)).toEqual(
          new Set([
            {
              files: 1,
              isSupported: true,
              lang: 'C++ (beta)',
            },
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
          limitToFiles: [`/GitHubAccessTokenScrambler12.java`],
          source: 'atom',
        });

        expect(response.type).toEqual('success');
        if (response.type === 'error') return;
        expect(response.value.status !== AnalysisStatus.failed).toBeTruthy();
      } while (response.value.status !== AnalysisStatus.complete);

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

      expect(response.value.sarif.runs[0].results).toHaveLength(4);
    },
    TEST_TIMEOUT,
  );
});
