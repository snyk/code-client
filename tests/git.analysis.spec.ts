
import { baseURL, sessionToken } from './constants/base';
import parseGitUri from '../src/gitUtils';
import { analyzeGit } from '../src/analysis';

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
    const fullRepoKey = parseGitUri('git@github.com:DeepCodeAI/cli.git@320d98a6896f5376efe6cefefb6e70b46b97d566');
    expect(fullRepoKey).toEqual({
      oid: '320d98a6896f5376efe6cefefb6e70b46b97d566',
      owner: 'DeepCodeAI',
      platform: 'github.com',
      repo: 'cli',
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
    expect(Object.keys(bundle.analysisResults.files).length).toEqual(2);
    expect(Object.keys(bundle.analysisResults.suggestions).length).toEqual(2);
  });
  it('analyze remote git with oid and return sarif', async () => {
    const bundle = await analyzeGit(
      baseURL,
      sessionToken,
      false,
      1,
      'git@github.com:DeepCodeAI/cli.git@320d98a6896f5376efe6cefefb6e70b46b97d566',
    );
    console.log(bundle.sarifResults)
    expect(bundle.sarifResults).toEqual(true);
  });
});
