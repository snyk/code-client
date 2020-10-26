
import { baseURL, sessionToken } from './constants/base';
import { analyzeGit } from '../src/analysis';
import jsonschema from 'jsonschema';
import { Log } from 'sarif';
import * as sarifSchema from './sarif-schema-2.1.0.json';
import { ErrorCodes } from '../src/constants';
import { IGitBundle } from '../src/interfaces/analysis-result.interface';

const oAuthToken = process.env.DEEPCODE_OAUTH_KEY || '';
const sessionTokenNoRepoAccess = process.env.DEEPCODE_API_KEY_NO_ACCESS || '';

// This trick is for automatic tests, where real oauth token is not available
const itif = (condition: any) => condition ? it : it.skip;

describe('Functional test of analysis', () => {
  it('analyze remote git without oid', async () => {
    const bundle = await analyzeGit(baseURL, sessionToken, false, 1, 'git@github.com:DeepCodeAI/cli.git');
    expect(bundle.analysisResults.files).toBeTruthy();
    expect(bundle.analysisResults.suggestions).toBeTruthy();
  });

  itif(oAuthToken)('analyze remote git with oid', async () => {
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
  });

  itif(oAuthToken && sessionTokenNoRepoAccess)('analyze private remote git with oAuthToken', async () => {

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
  });

  describe('detailed sarif tests', () => {
    let sarifResults: Log | undefined;
    it('analyze remote git with oid and return sarif', async () => {
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
    });
    it('should match sarif schema', () => {
      const validationResult = jsonschema.validate(sarifResults, sarifSchema);
      // this is to debug any errors found
      // const json = JSON.stringify(validationResult)
      // fs.writeFile('sarif_validation_log.json', json, 'utf8', ()=>null);
      expect(validationResult.errors.length).toEqual(0);
    });
  });
});
