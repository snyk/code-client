
import { baseURL, sessionToken } from './constants/base';
import { bundleFiles, bundleFilesFull } from './constants/sample';

import {
  getFilters,
  startSession,
  checkSession,
  createBundle,
  createGitBundle,
  checkBundle,
  uploadFiles,
  extendBundle,
  getAnalysis,
  AnalysisStatus,
  reportError,
  reportEvent,
} from '../src/http';

const fakeBundleId = '646c61854ef8ef5634d9caf2580352bc416b3d066f800832b47088d4169cf231';
let fakeBundleIdFull = '';
const realBundleId = 'e03ac612f79b73ef6f55bdd3e32d324fb43dc138f9883bbb41085a6db59d67f5';
let realBundleIdFull = '';

const reportTelemetryRequest = {
  baseURL,
  sessionToken,
  bundleId: fakeBundleId,
  source: 'testSource',
  type: 'testType',
  message: 'testMessage',
  path: '/test/path',
  data: {
    foo: 'bar',
    bar: ['fo', 'foo', 'fooo'],
  },
};


describe('Requests to public API', () => {
  it('gets filters successfully', async () => {
    const response = await getFilters(baseURL);
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(new Set(response.value.configFiles)).toEqual(
      new Set([
        '.dcignore',
        '.gitignore',
        '.pylintrc',
        'pylintrc',
        '.pmdrc.xml',
        '.ruleset.xml',
        'ruleset.xml',
        'tslint.json',
        '.eslintrc.js',
        '.eslintrc.json',
        '.eslintrc.yml',
      ]),
    );
    expect(new Set(response.value.extensions)).toEqual(
      new Set([
        '.es',
        '.es6',
        '.htm',
        '.html',
        '.js',
        '.jsx',
        '.ts',
        '.tsx',
        '.vue',
        '.c',
        '.cc',
        '.cpp',
        '.cxx',
        '.h',
        '.hpp',
        '.hxx',
        '.py',
        '.java',
        '.CS',
        '.Cs',
        '.cs',
        '.php',
      ]),
    );
  });

  it('reports error successfully', async () => {
    const response = await reportError(reportTelemetryRequest);
    expect(response.type).toEqual('success');
  });

  it('reports event successfully', async () => {
    const response = await reportEvent(reportTelemetryRequest);
    expect(response.type).toEqual('success');
  });

  it('starts session successfully', async () => {
    const startSessionResponse = await startSession({
      source: 'atom',
      baseURL,
    });
    expect(startSessionResponse.type).toEqual('success');
    if (startSessionResponse.type === 'error') return;

    expect(startSessionResponse.value.loginURL).toMatch(
      /.*\/login-api\?sessionToken=.*&source=atom/,
    );
    const draftToken = startSessionResponse.value.sessionToken;

    // This token is just a draft and not ready to be used permanently
    const checkSessionResponse = await checkSession({ baseURL, sessionToken: draftToken });
    expect(checkSessionResponse.type).toEqual('success');
    if (checkSessionResponse.type === 'error') return;
    expect(checkSessionResponse.value).toEqual(false);
  });

  it('checks session unsuccessfully', async () => {
    const response = await checkSession({
      baseURL,
      sessionToken: 'dummy-token',
    });
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value).toEqual(false);
  });

  it('checks session successfully', async () => {
    const response = await checkSession({
      baseURL,
      sessionToken,
    });
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value).toEqual(true);
  });

  it('creates bundle successfully', async () => {
    const files = Object.fromEntries([...(await bundleFiles).entries()].map(([i, d]) => [d.bundlePath, `${i}`]));

    const response = await createBundle({
      baseURL,
      sessionToken,
      files,
    });
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value.bundleId).toContain(fakeBundleId);
    fakeBundleIdFull = response.value.bundleId;
    expect(response.value.missingFiles).toEqual([
      '/.eslintrc.json',
      `/AnnotatorTest.cpp`,
      `/GitHubAccessTokenScrambler12.java`,
      `/app.js`,
      `/db.js`,
      `/main.js`,
      `/routes/index.js`,
      `/routes/sharks.js`,
    ]);
  });

  it('checks bundle successfully', async () => {
    const response = await checkBundle({
      baseURL,
      sessionToken,
      bundleId: fakeBundleIdFull,
    });
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value.bundleId).toEqual(fakeBundleIdFull);
    expect(response.value.missingFiles).toEqual([
      '/.eslintrc.json',
      `/AnnotatorTest.cpp`,
      `/GitHubAccessTokenScrambler12.java`,
      `/app.js`,
      `/db.js`,
      `/main.js`,
      `/routes/index.js`,
      `/routes/sharks.js`,
    ]);
  });

  it('checks expired bundle successfully', async () => {
    const response = await checkBundle({
      baseURL,
      sessionToken,
      bundleId: 'mock-expired-bundle-id',
    });
    expect(response.type).toEqual('error');
    // dummy to cheat typescript compiler
    if (response.type == 'success') return;
    expect(response.error.statusCode).toEqual(404);
    expect(response.error.statusText).toEqual('Uploaded bundle has expired');
  });

  it('request analysis with missing files', async () => {
    const response = await getAnalysis({
      baseURL,
      sessionToken,
      bundleId: fakeBundleIdFull,
      useLinters: false,
      severity: 1,
    });
    expect(response.type).toEqual('error');
    if (response.type === 'success') return;
    expect(response.error).toEqual({
      apiName: 'getAnalysis',
      statusCode: 500,
      statusText: 'Getting analysis failed',
    });
  });

  it('extends bundle successfully', async () => {
    const response = await extendBundle({
      baseURL,
      sessionToken,
      bundleId: fakeBundleIdFull,
      files: {
        [`/new.js`]: 'new123',
      },
      removedFiles: [
        '/.eslintrc.json',
        `/app.js`,
        `/AnnotatorTest.cpp`,
        `/GitHubAccessTokenScrambler12.java`,
        `/db.js`,
        `/main.js`,
        `/routes/index.js`,
        `/routes/sharks.js`,
      ],
    });
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value.bundleId).toContain(
      '587a6bcb0095606ad57ccc7bb7ac6401475ce4181c13f7136491a16df06544f1',
    );
    expect(response.value.missingFiles).toEqual([`/new.js`]);
  });

  it('extends expired bundle successfully', async () => {
    const response = await extendBundle({
      baseURL,
      sessionToken,
      bundleId: 'wrong-bundle-id',
      files: {
        [`/new2.js`]: 'new1234',
      },
    });

    expect(response.type).toEqual('error');
    // dummy to cheat typescript compiler
    if (response.type == 'success') return;

    expect(response.error.statusCode).toEqual(404);
    expect(response.error.statusText).toEqual('Parent bundle has expired');
  });

  it('uploads fake files to fake bundle', async () => {
    const response = await uploadFiles({
      baseURL,
      sessionToken,
      bundleId: fakeBundleIdFull,
      content: [
        {
          fileHash: 'df',
          fileContent: 'const module = new Module();',
        },
        {
          fileHash: 'sdfs',
          fileContent: 'const App = new App();',
        },
      ],
    });
    expect(response.type).toEqual('error');
    if (response.type === 'success') return;
    expect(response.error).toEqual({
      apiName: 'uploadFiles',
      statusCode: 400,
      statusText:
        'Invalid request, attempted to extend a git bundle, or ended up with an empty bundle after the extension',
    });
  });

  it('test successful workflow with and without linters', async () => {
    // Create a bundle first
    const files = Object.fromEntries((await bundleFilesFull).map(d => [d.bundlePath, d.hash]));

    const bundleResponse = await createBundle({
      baseURL,
      sessionToken,
      files,
    });
    expect(bundleResponse.type).toEqual('success');
    if (bundleResponse.type === 'error') return;
    expect(bundleResponse.value.bundleId).toContain(realBundleId);
    realBundleIdFull = bundleResponse.value.bundleId;

    const content = (await bundleFilesFull).map(d => {
      return {
        fileHash: d.hash,
        fileContent: d.content || '',
      };
    });

    // Upload files
    const uploadResponse = await uploadFiles({
      baseURL,
      sessionToken,
      bundleId: realBundleIdFull,
      content: content,
    });
    expect(uploadResponse.type).toEqual('success');
    if (uploadResponse.type === 'error') return;
    expect(uploadResponse.value).toEqual(true);

    // Check missing files
    const checkResponse = await checkBundle({
      baseURL,
      sessionToken,
      bundleId: realBundleIdFull,
    });
    expect(checkResponse.type).toEqual('success');
    if (checkResponse.type === 'error') return;
    expect(checkResponse.value.bundleId).toEqual(realBundleIdFull);
    expect(checkResponse.value.missingFiles).toEqual([]);

    // Get analysis results without linters
    let response = await getAnalysis({
      baseURL,
      sessionToken,
      bundleId: realBundleIdFull,
      useLinters: false,
      severity: 1,
    });
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value.status !== AnalysisStatus.failed).toBeTruthy();

    if (response.value.status === AnalysisStatus.done) {
      expect(response.value.analysisURL.includes(realBundleIdFull)).toBeTruthy();
      expect(Object.keys(response.value.analysisResults.suggestions).length).toEqual(8);
      const suggestion = response.value.analysisResults.suggestions[0];
      expect(suggestion.id).toEqual('cpp%2Fdc%2FCppSameEvalBinaryExpressionfalse');
      expect(suggestion.leadURL).toEqual('');
      expect(suggestion.repoDatasetSize).toEqual(0);
      expect(suggestion.exampleCommitDescriptions).toEqual([]);
      expect(suggestion.exampleCommitFixes).toEqual([]);
      expect(suggestion.message).toEqual(
        'The expression will always evaluate to false because both sides always hold the same value.',
      );
      expect(suggestion.rule).toEqual('CppSameEvalBinaryExpressionfalse');
      expect(suggestion.severity).toEqual(2);
      expect(suggestion.tags).toEqual([]);
      expect(Object.keys(response.value.analysisResults.files).length).toEqual(4);
      expect(response.value.analysisResults.files[`/AnnotatorTest.cpp`]).toEqual({
        '0': [
          {
            cols: [8, 27],
            markers: [],
            rows: [5, 5],
          },
        ],
        '1': [
          {
            cols: [6, 25],
            markers: [
              {
                msg: [25, 36],
                pos: [
                  {
                    cols: [7, 14],
                    rows: [8, 8],
                  },
                ],
              },
              {
                msg: [45, 57],
                pos: [
                  {
                    cols: [6, 25],
                    rows: [10, 10],
                  },
                ],
              },
            ],
            rows: [10, 10],
          },
        ],
      });
    }

    // Get analysis results without linters but with severity 3
    response = await getAnalysis({
      baseURL,
      sessionToken,
      bundleId: realBundleIdFull,
      useLinters: false,
      severity: 3,
    });
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value.status !== AnalysisStatus.failed).toBeTruthy();
    if (response.value.status === AnalysisStatus.done) {
      expect(Object.keys(response.value.analysisResults.suggestions).length).toEqual(2);
      expect(Object.keys(response.value.analysisResults.files).length).toEqual(1);
    }

  });

  it('create git bundle', async () => {
    const bundleResponse = await createGitBundle({
      baseURL,
      sessionToken,
      gitUri: 'git@github.com:DeepCodeAI/cli.git',
    });
    expect(bundleResponse.type).toEqual('success');
    if (bundleResponse.type === 'error') return;
    expect(bundleResponse.value.bundleId).toBeTruthy();
  });

  it('git analysis', async () => {
    const bundleId = 'gh/DeepcodeAI/cli/320d98a6896f5376efe6cefefb6e70b46b97d566';

    // Get analysis results
    const response = await getAnalysis({
      baseURL,
      sessionToken,
      bundleId,
      useLinters: false,
      severity: 1,
    });
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value.status !== AnalysisStatus.failed).toBeTruthy();

    if (response.value.status === AnalysisStatus.done) {
      expect(response.value.analysisURL.includes(bundleId)).toBeTruthy();
      expect(response.value.analysisResults.suggestions).toBeTruthy();

      const suggestion = response.value.analysisResults.suggestions[0];
      expect(suggestion.categories).toEqual(['Security', 'InTest']);
      expect(suggestion).toHaveProperty('exampleCommitDescriptions');
      expect(suggestion).toHaveProperty('exampleCommitFixes');
      expect(suggestion.leadURL).toEqual('');
      expect(suggestion.id).toEqual('python%2Fdc%2FHardcodedNonCryptoSecret%2Ftest');
      expect(suggestion.message).toContain(
        'Avoid hardcoding values that are meant to be secret. Found hardcoded string:',
      );
      expect(suggestion.rule).toEqual('HardcodedNonCryptoSecret/test');
      expect(suggestion.severity).toEqual(1);
      expect(suggestion.tags).toEqual(['maintenance', 'bug', 'key', 'secret', 'credentials']);
      expect(Object.keys(response.value.analysisResults.files).length).toEqual(1);
    }
  });
});
