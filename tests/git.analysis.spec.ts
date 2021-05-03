import * as fs from 'fs';

import { baseURL, sessionToken, TEST_TIMEOUT } from './constants/base';
import { analyzeGit } from '../src/analysis';
import jsonschema from 'jsonschema';
import { Log } from 'sarif';
import * as sarifSchema from './sarif-schema-2.1.0.json';
import { ErrorCodes } from '../src/constants';
import { IGitBundle } from '../src/interfaces/analysis-result.interface';
import axios from '../src/axios';

const oAuthToken = process.env.SNYK_OAUTH_KEY || '';
const sessionTokenNoRepoAccess = process.env.SNYK_API_KEY_NO_ACCESS || '';

// This trick is for automatic tests, where real oauth token is not available
const itif = (condition: boolean) => (condition ? it : it.skip);

describe('Functional test of analysis', () => {
  it(
    'analyze remote git without oid',
    async () => {
      const bundle = await analyzeGit({
        baseURL,
        sessionToken,
        includeLint: false,
        severity: 1,
        gitUri: 'git@github.com:DeepCodeAI/cli.git',
      });
      expect(bundle.analysisResults.files).toBeTruthy();
      expect(bundle.analysisResults.suggestions).toBeTruthy();
    },
    TEST_TIMEOUT,
  );

  itif(!!oAuthToken)(
    'analyze remote git with oid',
    async () => {
      const bundle = await analyzeGit({
        baseURL,
        sessionToken,
        includeLint: false,
        severity: 1,
        gitUri: 'git@github.com:DeepCodeAI/cli.git@320d98a6896f5376efe6cefefb6e70b46b97d566',
      });
      expect(bundle.analysisResults.files).toBeTruthy();
      expect(Object.keys(bundle.analysisResults.files).length).toEqual(1);
      expect(bundle.analysisResults.suggestions).toBeTruthy();
      expect(Object.keys(bundle.analysisResults.suggestions).length).toEqual(1);
    },
    TEST_TIMEOUT,
  );

  itif(!!(oAuthToken && sessionTokenNoRepoAccess))(
    'analyze private remote git with oAuthToken',
    async () => {
      let failedGit: IGitBundle | undefined;
      try {
        failedGit = await analyzeGit({
          baseURL,
          sessionToken: sessionTokenNoRepoAccess,
          includeLint: false,
          severity: 1,
          gitUri: 'git@github.com:DeepCodeAI/testcrepo.git',
        });
      } catch (failed) {
        expect(failed.statusCode).toEqual(ErrorCodes.unauthorizedBundleAccess);
      }
      expect(failedGit).toBe(undefined);

      const bundle = await analyzeGit({
        baseURL,
        sessionToken: sessionTokenNoRepoAccess,
        includeLint: false,
        severity: 1,
        gitUri: 'git@github.com:DeepCodeAI/testcrepo.git',
        sarif: false,
        oAuthToken,
      });
      expect(bundle.analysisResults.files).toBeTruthy();
      expect(bundle.analysisResults.suggestions).toBeTruthy();
    },
    TEST_TIMEOUT,
  );

  it(
    'CWE fields in analysis results',
    async () => {
      const bundle = await analyzeGit({
        baseURL,
        sessionToken,
        includeLint: false,
        severity: 1,
        gitUri: 'git@github.com:eclipse/che.git@75889e8c33601e8986e75bad74456cff39e511c0',
        sarif: true,
      });

      // Test DC JSON format first
      expect(Object.keys(bundle.analysisResults.suggestions).length).toEqual(134);

      const cweSuggestion = Object.values(bundle.analysisResults.suggestions).find(
        s => s.id === 'java%2Fdc_interfile_project%2FPT',
      );

      expect(cweSuggestion?.cwe).toEqual(['CWE-23']);
      expect(cweSuggestion?.title).toBeTruthy();
      expect(cweSuggestion?.text).toBeTruthy();

      expect(bundle.sarifResults?.runs[0].results?.length).toEqual(442);
      expect(bundle.sarifResults?.runs[0].tool?.driver.rules?.length).toEqual(134);

      const cweRule = bundle.sarifResults?.runs[0].tool?.driver.rules?.find(r => r.id === 'java/PT');
      expect(cweRule?.properties?.cwe).toContain('CWE-23');
      expect(cweRule?.shortDescription?.text).toEqual('Path Traversal');
    },
    TEST_TIMEOUT,
  );

  describe('detailed sarif tests', () => {
    let sarifResults: Log | undefined;
    it(
      'analyze remote git with oid and return sarif',
      async () => {
        const bundle = await analyzeGit({
          baseURL,
          sessionToken,
          includeLint: false,
          severity: 1,
          gitUri: 'git@github.com:DeepCodeAI/cli.git@320d98a6896f5376efe6cefefb6e70b46b97d566',
          sarif: true,
        });
        sarifResults = bundle.sarifResults;
        expect(!!bundle.sarifResults).toEqual(true);
      },
      TEST_TIMEOUT,
    );

    it(
      'analyze remote git and formatter sarif with zero supported files',
      async () => {
        const bundle = await analyzeGit({
          baseURL,
          sessionToken,
          includeLint: false,
          severity: 1,
          gitUri: 'git@github.com:DeepCodeAI/test-bigfiles.git@e7633ef98fba3ddc24e5bea27ae58d5b08b2f949',
          sarif: true,
        });
        expect(bundle.sarifResults?.runs[0].properties?.coverage).toEqual([
          {
            files: 3,
            isSupported: false,
            lang: 'Text',
          },
          {
            files: 1,
            isSupported: false,
            lang: 'Markdown',
          },
        ]);
      },
      TEST_TIMEOUT,
    );

    it(
      'analyze remote git and formatter sarif with supported files',
      async () => {
        const bundle = await analyzeGit({
          baseURL,
          sessionToken,
          includeLint: false,
          severity: 1,
          gitUri: 'git@github.com:OpenRefine/OpenRefine.git@437dc4d74110ce006b9f829fe05f461cc8ed1170',
          sarif: true,
        });
        expect(bundle.sarifResults?.runs[0].properties?.coverage).toMatchSnapshot();

        const numOfIssues = getNumOfIssues(bundle);
        const numOfIssuesInSarif = bundle.sarifResults?.runs[0].results?.length;

        expect(numOfIssuesInSarif).toEqual(numOfIssues);
      },
      TEST_TIMEOUT,
    );

    it('should match sarif schema', () => {
      const validationResult = jsonschema.validate(sarifResults, sarifSchema);
      // this is to debug any errors found
      // const json = JSON.stringify(validationResult)
      // fs.writeFile('sarif_validation_log.json', json, 'utf8', ()=>null);
      expect(validationResult.errors.length).toEqual(0);
    });
  });
});

describe('Custom request options', () => {
  beforeAll(() => {
    jest.mock('axios');
    axios.request = jest.fn().mockRejectedValue({});
  });

  it(
    'passes custom options correctly',
    async () => {
      try {
        await analyzeGit(
          {
            baseURL,
            sessionToken,
            includeLint: false,
            severity: 1,
            gitUri: 'git@github.com:DeepCodeAI/cli.git',
          },
          { headers: { 'X-test-header': 'Snyk' } },
        );
      } catch (e) {
        // expected to fail, we are interested in correct propagation of headers only
      }
      expect((axios.request as jest.Mock).mock.calls[0][0]).toMatchObject({ headers: { 'X-test-header': 'Snyk' } });
    },
    TEST_TIMEOUT,
  );

  afterAll(() => {
    jest.resetAllMocks();
  });
});

function getNumOfIssues(bundle: IGitBundle): number {
  let numberOfIssues = 0;

  Object.keys(bundle.analysisResults.files).forEach(key =>
    Object.keys(bundle.analysisResults.files[key]).forEach(
      issueId => (numberOfIssues += bundle.analysisResults.files[key][issueId].length),
    ),
  );

  return numberOfIssues;
}
