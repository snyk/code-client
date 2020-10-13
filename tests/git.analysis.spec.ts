
import { baseURL, sessionToken } from './constants/base';
import parseGitUri from '../src/gitUtils';
import { analyzeGit } from '../src/analysis';
import jsonschema from 'jsonschema'
import { Log } from 'sarif'
import * as sarifSchema from './sarif-schema-2.1.0.json';
// import fs from 'fs';

describe('Functional test of analysis', () => {
  it('parge git uri short', () => {
    const repoKey = parseGitUri('git@github.com:DeepCodeAI/cli.git');
    expect(repoKey).toEqual({
      oid: undefined,
      owner: 'DeepCodeAI',
      platform: 'github.com',
      repo: 'cli',
    });
  });

  it('parge git uri full', () => {
    const fullRepoKey = parseGitUri('git@gitlab.com:test1290/sub-te_st/test-repo.git@sdvasfa2323');
    expect(fullRepoKey).toEqual({
      oid: 'sdvasfa2323',
      owner: 'test1290/sub-te_st',
      platform: 'gitlab.com',
      repo: 'test-repo',
    });
  });

  it('analyze remote git without oid', async () => {
    const bundle = await analyzeGit(baseURL, sessionToken, false, 1, 'git@github.com:DeepCodeAI/cli.git');
    expect(Object.keys(bundle.analysisResults.files).length).toEqual(0);
    expect(Object.keys(bundle.analysisResults.suggestions).length).toEqual(0);
  });

  it('analyze remote git with oid', async () => {
    const bundle = await analyzeGit(
      baseURL,
      sessionToken,
      false,
      1,
      'git@github.com:DeepCodeAI/cli.git@320d98a6896f5376efe6cefefb6e70b46b97d566',
    );
    expect(Object.keys(bundle.analysisResults.files).length).toEqual(1);
    expect(Object.keys(bundle.analysisResults.suggestions).length).toEqual(1);
    
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
        const validationResult = jsonschema.validate(sarifResults , sarifSchema);
        // this is to debug any errors found
        // const json = JSON.stringify(validationResult)
        // fs.writeFile('sarif_validation_log.json', json, 'utf8', ()=>null);
        expect(validationResult.errors.length).toEqual(0);
      });
    });
});
