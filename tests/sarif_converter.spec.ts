import * as fs from 'fs';

import jsonschema from 'jsonschema';
import * as sarifSchema from './sarif-schema-2.1.0.json';
import { stringSplice, getArgumentsAndMessage } from '../src/sarif_converter';
import getSarif from '../src/sarif_converter';
import * as analysisResultsWithoutFingerprinting from './fixtures/sarif_convertor/analysis-results-without-fingerprinting.json';
import { IAnalysisResult, IFileBundle, IGitBundle } from '../src/interfaces/analysis-result.interface';
import path from 'path';
import { analyzeFolders, analyzeGit } from '../src/analysis';
import { baseURL, sessionToken } from './constants/base';
import { AnalysisSeverity } from '../src/interfaces/analysis-result.interface';
import { Log, Result } from 'sarif';

describe('Sarif Convertor', () => {
  it('should keep us sane that we do not loose issues', async () => {
    const includeLint = false;
    const severity = AnalysisSeverity.info;
    const paths: string[] = [path.resolve(__dirname, 'fixtures/sarif_convertor/shallow_sast_webgoat')];
    const symlinksEnabled = false;
    const maxPayload = 10000000;
    const defaultFileIgnores = undefined;
    const sarif = true;
    let folderBundleResultsCount = 0;
    let gitBundleResultsCount = 0;
    const folderBundle = await analyzeFolders({
      baseURL,
      sessionToken,
      includeLint,
      severity,
      paths,
      symlinksEnabled,
      maxPayload,
      defaultFileIgnores,
      sarif,
    });
    const gitBundle = await analyzeGit({
      baseURL,
      sessionToken,
      includeLint: false,
      severity: 1,
      gitUri: 'git@github.com:DeepcodeAI/shallow_sast_webgoat.git',
      sarif: true,
    });
    folderBundleResultsCount = getNumOfIssues(folderBundle);
    gitBundleResultsCount = getNumOfIssues(gitBundle);
    expect(folderBundleResultsCount).toEqual(gitBundleResultsCount);
    expect(folderBundle.sarifResults?.runs[0]?.results?.length).toEqual(folderBundleResultsCount);
    expect(gitBundle.sarifResults?.runs[0]?.results?.length).toEqual(gitBundleResultsCount);
  }, 100000);

  it('should test no changes have occured in the sarif', () => {
    const sarifResults = getSarif(analysisResultsWithoutFingerprinting as unknown as IAnalysisResult);
    expect(sarifResults).toMatchSnapshot();
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

  it('should contain fingerprinting', () => {
    const sarifResults = getSarif(analysisResultsWithoutFingerprinting as unknown as IAnalysisResult);
    const validationResult = jsonschema.validate(sarifResults, sarifSchema);
    // this is to debug any errors found
    // const json = JSON.stringify(validationResult)
    // fs.writeFile('sarif_validation_log.json', json, 'utf8', ()=>null);
    expect(validationResult.errors.length).toEqual(0);

    //no fingerprinting
    expect(Object.keys((sarifResults.runs[0].results as any)[7].fingerprints).length).toEqual(0);

    //single fingerprinting
    expect((sarifResults.runs[0].results as any)[1].fingerprints[0]).toEqual(
      '1d9d2bce6036443e56e61ffb689caca291b33055d37810ba48423aae6eb29d16',
    );
    expect((sarifResults.runs[0].results as any)[2].fingerprints[0]).toEqual(
      'c8ede54bd6611ca074c42baf78809b9fe198c762ba8a1a78571befdf191869e5',
    );
    expect((sarifResults.runs[0].results as any)[3].fingerprints[0]).toEqual(
      '8105a5e15b9d725e663009985913a6931ba94ddd56f4854d24ba3565067501b4',
    );
    expect((sarifResults.runs[0].results as any)[4].fingerprints[0]).toEqual(
      '8a870ceae63c99fb925bcdcbaca7ce5c8ccf29024898cd1694d930b5d687842e',
    );
    expect((sarifResults.runs[0].results as any)[5].fingerprints[0]).toEqual(
      'c92fd0d8fbb0722ac17a8dfd6b9fd5c0770a64a3f965ed128ecc6ae45c20813b',
    );

    expect((sarifResults.runs[0].results as any)[9].fingerprints[0]).toEqual(
      '78d8a8779142d82cf9be9da7a167e8e06236ab0a67d324143494650a5e4badf2',
    );
    expect((sarifResults.runs[0].results as any)[10].fingerprints[0]).toEqual(
      'ce5c43465aac96db6e4505f48df1defaa81a38bf7876a1f0e7431c54304d9ea1',
    );

    //2 fingerprinting
    expect((sarifResults.runs[0].results as any)[0].fingerprints[0]).toEqual(
      'ae785dddd67d66083bf565a2ab826535bac183b3c477d249649c6596f2405dd6',
    );
    expect((sarifResults.runs[0].results as any)[0].fingerprints[1]).toEqual('12342');

    //3 fingerprinting
    expect((sarifResults.runs[0].results as any)[8].fingerprints[0]).toEqual(
      '719d356d9a2efebe9142ca79825c6c0e4b0e6f5013a6e3f3b04630243416ac87',
    );
  });

  it('should contain example commit fixes', () => {
    const sarifResults = getSarif(analysisResultsWithoutFingerprinting as unknown as IAnalysisResult);
    const validationResult = jsonschema.validate(sarifResults, sarifSchema);
    expect(validationResult.errors.length).toEqual(0);

    const rules = sarifResults?.runs[0].tool?.driver?.rules;
    let exampleCommitFixes;
    if (rules !== undefined) exampleCommitFixes = rules[6].properties?.exampleCommitFixes;

    expect(exampleCommitFixes.length).toBeGreaterThan(0);
    let exampleCommitFix = exampleCommitFixes[0];
    expect(exampleCommitFix?.commitURL).toBeTruthy();
    expect(exampleCommitFix?.lines).toBeTruthy();

    const exampleCommitFixLine = exampleCommitFix?.lines[0];
    expect(exampleCommitFixLine?.line).toBeTruthy();
    expect(exampleCommitFixLine?.lineNumber).toBeTruthy();
    expect(exampleCommitFixLine?.lineChange).toBeTruthy();
  });

  it('should contain example commit descriptions', () => {
    const sarifResults = getSarif(analysisResultsWithoutFingerprinting as unknown as IAnalysisResult);
    const validationResult = jsonschema.validate(sarifResults, sarifSchema);
    expect(validationResult.errors.length).toEqual(0);

    const rules = sarifResults?.runs[0].tool?.driver?.rules;
    let exampleCommitDescriptions;
    if (rules !== undefined) exampleCommitDescriptions = rules[0].properties?.exampleCommitDescriptions;

    expect(exampleCommitDescriptions.length).toBeGreaterThan(0);
  });

  it('Should contain arguments placeholders on message.markdown but not on message.text', () => {
    // Since the input for `getSarif` is constant and it includes arguments. we know that we expect
    // certain placeholders to be included in function's response
    const sarifResults: Log = getSarif(analysisResultsWithoutFingerprinting as unknown as IAnalysisResult);
    const validationResult = jsonschema.validate(sarifResults, sarifSchema);
    expect(validationResult.errors.length).toEqual(0);

    const results: Result[] = sarifResults.runs[0].results!;
    const { text = '', markdown = '' }: { text?: string; markdown?: string } = results[0].message;
    expect(text.includes('{0}')).toBeFalsy();
    expect(markdown.includes('{0}')).toBeTruthy();
  });
});

function getNumOfIssues(bundle: IGitBundle | IFileBundle): number {
  let numberOfIssues = 0;

  Object.keys(bundle.analysisResults.files).forEach(key =>
    Object.keys(bundle.analysisResults.files[key]).forEach(
      issueId => (numberOfIssues += bundle.analysisResults.files[key][issueId].length),
    ),
  );

  return numberOfIssues;
}
