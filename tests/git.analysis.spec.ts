import * as fs from 'fs';

import { baseURL, sessionToken, TEST_TIMEOUT } from './constants/base';
import { analyzeGit } from '../src/analysis';
import jsonschema from 'jsonschema';
import { Log } from 'sarif';
import * as sarifSchema from './sarif-schema-2.1.0.json';
import { ErrorCodes } from '../src/constants';
import { IGitBundle } from '../src/interfaces/analysis-result.interface';
import { stringSplice, getArgumentsAndMessage } from '../src/sarif_converter';

const oAuthToken = process.env.SNYK_OAUTH_KEY || '';
const sessionTokenNoRepoAccess = process.env.SNYK_API_KEY_NO_ACCESS || '';

// This trick is for automatic tests, where real oauth token is not available
const itif = (condition: boolean) => (condition ? it : it.skip);

describe('Functional test of analysis', () => {
  it(
    'analyze remote git without oid',
    async () => {
      const bundle = await analyzeGit(baseURL, sessionToken, false, 1, 'git@github.com:DeepCodeAI/cli.git');
      expect(bundle.analysisResults.files).toBeTruthy();
      expect(bundle.analysisResults.suggestions).toBeTruthy();
    },
    TEST_TIMEOUT,
  );

  itif(!!oAuthToken)(
    'analyze remote git with oid',
    async () => {
      const bundle = await analyzeGit(
        baseURL,
        sessionToken,
        false,
        1,
        'git@github.com:DeepCodeAI/cli.git@320d98a6896f5376efe6cefefb6e70b46b97d566',
      );
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
        failedGit = await analyzeGit(
          baseURL,
          sessionTokenNoRepoAccess,
          false,
          1,
          'git@github.com:DeepCodeAI/testcrepo.git',
        );
      } catch (failed) {
        expect(failed.statusCode).toEqual(ErrorCodes.unauthorizedBundleAccess);
      }
      expect(failedGit).toBe(undefined);

      const bundle = await analyzeGit(
        baseURL,
        sessionTokenNoRepoAccess,
        false,
        1,
        'git@github.com:DeepCodeAI/testcrepo.git',
        false,
        oAuthToken,
      );
      expect(bundle.analysisResults.files).toBeTruthy();
      expect(bundle.analysisResults.suggestions).toBeTruthy();
    },
    TEST_TIMEOUT,
  );

  it(
    'CWE fields in analysis results',
    async () => {
      const bundle = await analyzeGit(
        baseURL,
        sessionToken,
        false,
        1,
        'git@github.com:eclipse/che.git@75889e8c33601e8986e75bad74456cff39e511c0',
        true,
      );

      // Test DC JSON format first
      expect(Object.keys(bundle.analysisResults.suggestions).length).toEqual(119);

      const cweSuggestion = Object.values(bundle.analysisResults.suggestions).find(
        s => s.id === 'java%2Fdc_interfile_project%2FPT',
      );

      expect(cweSuggestion?.cwe).toEqual(['CWE-23']);
      expect(cweSuggestion?.title).toBeTruthy();
      expect(cweSuggestion?.text).toBeTruthy();

      expect(bundle.sarifResults?.runs[0].results?.length).toEqual(119);
      expect(bundle.sarifResults?.runs[0].tool?.driver.rules?.length).toEqual(119);

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
        const bundle = await analyzeGit(
          baseURL,
          sessionToken,
          false,
          1,
          'git@github.com:DeepCodeAI/cli.git@320d98a6896f5376efe6cefefb6e70b46b97d566',
          true,
        );
        sarifResults = bundle.sarifResults;
        expect(!!bundle.sarifResults).toEqual(true);
      },
      TEST_TIMEOUT,
    );

    it(
      'analyze remote git and formatter sarif with zero supported files',
      async () => {
        const bundle = await analyzeGit(
          baseURL,
          sessionToken,
          false,
          1,
          'git@github.com:DeepCodeAI/test-bigfiles.git@e7633ef98fba3ddc24e5bea27ae58d5b08b2f949',
          true,
        );
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

    it('should match sarif schema', () => {
      const validationResult = jsonschema.validate(sarifResults, sarifSchema);
      // this is to debug any errors found
      // const json = JSON.stringify(validationResult)
      // fs.writeFile('sarif_validation_log.json', json, 'utf8', ()=>null);
      expect(validationResult.errors.length).toEqual(0);
    });

    it('should test stringsplice functionality', () => {
      let message = 'this is a test message';
      let splicedMessage = stringSplice(message, 8, 1, 'not');
      expect(splicedMessage === 'this is not a test message');
    });
    it('should test message highlighting functionality', () => {
      let helpers = [
        {
          index: [0],
          msg: [23, 34],
        },
        {
          index: [1, 2, 3, 4, 5, 6, 7],
          msg: [36, 40],
        },
        {
          index: [8],
          msg: [47, 47],
        },
      ];
      let messageToEdit =
        'Unsanitized input from an exception flows into 0, where it is used to dynamically construct the HTML page on client side. This may result in a DOM Based Cross-Site Scripting attack (DOMXSS).';
      let { message, argumentArray } = getArgumentsAndMessage(helpers, messageToEdit);
      expect(
        message ===
          'Unsanitized input from {0} {1} into {2}, where it is used to dynamically construct the HTML page on client side. This may result in a DOM Based Cross-Site Scripting attack (DOMXSS).',
      );
      let expectedArgumentArray = ['[an exception](0)', '[flows](1),(2),(3),(4),(5),(6),(7)', '[0](8)'];
      argumentArray.forEach((arg, i) => expect(arg === expectedArgumentArray[i]));
    });
  });
});
