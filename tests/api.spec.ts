import { baseURL, sessionToken, bundleFiles, sampleProjectPath } from './constants/base';

import {
  getFilters,
  startSession,
  checkSession,
  createBundle,
  checkBundle,
  uploadFiles,
  extendBundle,
  getAnalysis,
  AnalysisStatus,
  reportError,
  reportEvent,
} from '../src/http';
import { prepareFilePath, getFileMeta } from '../src/files';

import { checkBundleError404, extendBundleError404 } from './constants/errors';
// import { supportedFiles } from '../src/utils/filesUtils';

const fakeBundleId = 'aa64f67b74231558ca67874621882ea728230c4cc0f70929f8a4b512ac9795a0';
let fakeBundleIdFull = '';
const realBundleId = 'a4e83d44b91ddd1c3e3be3932b68725e80dd813eb7bc7a660c769b9439b4b220';
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
      /https:\/\/www.deepcoded.com\/login-api\?sessionToken=.*&source=atom/,
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
    const files = Object.fromEntries([...bundleFiles.entries()].map(([i, d]) => [prepareFilePath(d), `${i}`]));

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
      `${sampleProjectPath}/AnnotatorTest.cpp`,
      `${sampleProjectPath}/GitHubAccessTokenScrambler12.java`,
      `${sampleProjectPath}/app.js`,
      `${sampleProjectPath}/db.js`,
      `${sampleProjectPath}/main.js`,
      `${sampleProjectPath}/routes/index.js`,
      `${sampleProjectPath}/routes/sharks.js`,
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
      `${sampleProjectPath}/AnnotatorTest.cpp`,
      `${sampleProjectPath}/GitHubAccessTokenScrambler12.java`,
      `${sampleProjectPath}/app.js`,
      `${sampleProjectPath}/db.js`,
      `${sampleProjectPath}/main.js`,
      `${sampleProjectPath}/routes/index.js`,
      `${sampleProjectPath}/routes/sharks.js`,
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
    expect(response.error.statusCode).toEqual(checkBundleError404.statusCode);
    expect(response.error.statusText).toEqual(checkBundleError404.statusText);
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
        [`${sampleProjectPath}/new.js`]: 'new123',
      },
      removedFiles: [
        `${sampleProjectPath}/app.js`,
        `${sampleProjectPath}/AnnotatorTest.cpp`,
        `${sampleProjectPath}/GitHubAccessTokenScrambler12.java`,
        `${sampleProjectPath}/db.js`,
        `${sampleProjectPath}/main.js`,
        `${sampleProjectPath}/routes/index.js`,
        `${sampleProjectPath}/routes/sharks.js`,
      ],
    });
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value.bundleId).toEqual(
      'gh/Arvi3d/DEEPCODE_PRIVATE_BUNDLE/28f6535914390760cdf36801719204a159bdfc699031701e7236b91f3df5d171',
    );
    expect(response.value.missingFiles).toEqual([`${sampleProjectPath}/new.js`]);
  });

  it('extends expired bundle successfully', async () => {
    const response = await extendBundle({
      baseURL,
      sessionToken,
      bundleId: 'wrong-bundle-id',
      files: {
        [`${sampleProjectPath}/new2.js`]: 'new1234',
      },
    });

    expect(response.type).toEqual('error');
    // dummy to cheat typescript compiler
    if (response.type == 'success') return;
    expect(response.error.statusCode).toEqual(extendBundleError404.statusCode);
    expect(response.error.statusText).toEqual(extendBundleError404.statusText);
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
      statusCode: 400,
      statusText:
        'Invalid request, attempted to extend a git bundle, or ended up with an empty bundle after the extension',
    });
  });

  it('test successful workflow', async () => {
    // Create a bundle first
    const files = Object.fromEntries(bundleFiles.map(d => [prepareFilePath(d), getFileMeta(d).hash]));

    const bundleResponse = await createBundle({
      baseURL,
      sessionToken,
      files,
    });
    expect(bundleResponse.type).toEqual('success');
    if (bundleResponse.type === 'error') return;
    expect(bundleResponse.value.bundleId).toContain(realBundleId);
    realBundleIdFull = bundleResponse.value.bundleId;

    const content = bundleFiles.map(d => {
      const fileData = getFileMeta(d);
      return {
        fileHash: fileData.hash,
        fileContent: fileData.content || '',
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

    // Get analysis results
    const response = await getAnalysis({
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
      expect(response.value.analysisResults.suggestions[0]).toEqual({
        categories: {
          Check: 1,
          InTest: 1,
        },
        id: 'cpp%2Fdc%2FCppSameEvalBinaryExpressionfalse',
        lead_url: '',
        message: 'The expression will always evaluate to false because both sides always hold the same value.',
        rule: 'CppSameEvalBinaryExpressionfalse',
        severity: 2,
        tags: [],
      });
      expect(Object.keys(response.value.analysisResults.files).length).toEqual(4);
      expect(response.value.analysisResults.files[`${sampleProjectPath}/AnnotatorTest.cpp`]).toEqual({
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
  });
});
