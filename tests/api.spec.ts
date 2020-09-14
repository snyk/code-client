
import { defaultBaseURL as baseURL } from '../src/constants';
import { sessionToken, bundleId, bundleFiles, sampleProjectPath } from './constants/base';

import { getFilters, startSession, checkSession, createBundle, checkBundle, uploadFiles, extendBundle, getAnalysis } from '../src/http';
import { prepareFilePath } from '../src/files';

// import {
//   extendBundleRequestExpired,
//   reportTelemetryRequest,
// } from './mocks/requests';
import {
  // getAnalysisResponse,
  checkBundleError404,
  extendBundleError404,
} from './constants/responses';
// import { supportedFiles } from '../src/utils/filesUtils';

const fakeBundleId = 'gh/Arvi3d/DEEPCODE_PRIVATE_BUNDLE/aa64f67b74231558ca67874621882ea728230c4cc0f70929f8a4b512ac9795a0';

describe('Requests to public API', () => {

  it('gets filters successfully', async () => {
    const response = await getFilters(baseURL);
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value).toEqual({
      configFiles: [
        '.dcignore',
        '.gitignore',
        '.eslintrc.js',
        '.eslintrc.json',
        '.eslintrc.yml',
        '.pylintrc',
        'pylintrc',
        '.pmdrc.xml',
        '.ruleset.xml',
        'ruleset.xml',
        'tslint.json',
      ],
      'extensions': [
        '.es',
        '.es6',
        '.htm',
        '.html',
        '.js',
        '.jsx',
        '.ts',
        '.tsx',
        '.vue',
        '.py',
        '.c',
        '.cc',
        '.cpp',
        '.cxx',
        '.h',
        '.hpp',
        ".hxx",
        ".java",
      ],
    });
  });

  // it('reports error successfully', async () => {
  //   const response = await api.reportError(reportTelemetryRequest);
  //   expect(response.type).toEqual('success');
  // });

  // it('reports event successfully', async () => {
  //   const response = await api.reportEvent(reportTelemetryRequest);
  //   expect(response.type).toEqual('success');
  // });

  it('starts session successfully', async () => {
    const startSessionResponse = await startSession({
      source: 'atom',
      baseURL,
    });
    expect(startSessionResponse.type).toEqual('success');
    if (startSessionResponse.type === 'error') return;

    expect(startSessionResponse.value.loginURL).toMatch(/https:\/\/www.deepcode.ai\/login-api\?sessionToken=.*&source=atom/);
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
    expect(response.value.bundleId).toEqual(fakeBundleId);
    expect(response.value.uploadURL).toEqual(`https://www.deepcode.ai/publicapi/file/${fakeBundleId}`);
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
      bundleId: fakeBundleId,
    });
    expect(response.type).toEqual('success');
    if (response.type === 'error') return;
    expect(response.value.bundleId).toEqual(fakeBundleId);
    expect(response.value.uploadURL).toEqual(`https://www.deepcode.ai/publicapi/file/${fakeBundleId}`);
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

  // it('request analysis with missing files', async () => {
  //   const response = await getAnalysis({
  //     baseURL,
  //     sessionToken,
  //     bundleId: fakeBundleId,
  //     useLinters: false,
  //     severity: 1
  //   });
  //   expect(response.type).toEqual('error');
  //   if (response.type === 'success') return;
  //   expect(response.error).toEqual({});
  // });

  it('extends bundle successfully', async () => {
    const response = await extendBundle({
      baseURL,
      sessionToken,
      bundleId: fakeBundleId,
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
    expect(response.value.bundleId).toEqual('gh/Arvi3d/DEEPCODE_PRIVATE_BUNDLE/28f6535914390760cdf36801719204a159bdfc699031701e7236b91f3df5d171');
    expect(response.value.missingFiles).toEqual([
      `${sampleProjectPath}/new.js`,
    ]);
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

  /**
   * Upload Files
   */
  // it('uploads files successfully', async () => {
  //   const response = await uploadFiles({
  //     baseURL,
  //     sessionToken,
  //     bundleId,
  //     content: [
  //       {
  //         fileHash: hashMain,
  //         fileContent: 'const module = new Module();',
  //       },
  //       {
  //         fileHash: hashApp,
  //         fileContent: 'const App = new App();',
  //       },
  //     ],
  //   });
  //   expect(response.type).toEqual('success');
  // });

  // /**
  //  * Get Analysis
  //  */
  // it('gets analysis successfully', async () => {
  //   const options = {
  //     baseURL,
  //     sessionToken,
  //     bundleId,
  //   };

  //   const response = await api.getAnalysis(options);
  //   expect(response.type).toEqual('success');
  //   if (response.type === 'error') return;
  //   expect(response.value).toEqual(getAnalysisResponse);
  // });

});
