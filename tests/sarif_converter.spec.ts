import * as fs from 'fs';

import jsonschema from 'jsonschema';
import * as sarifSchema from './sarif-schema-2.1.0.json';
import { stringSplice, getArgumentsAndMessage } from '../src/sarif_converter';
import getSarif from '../src/sarif_converter'
import * as analysisResultsWithoutFingerprinting from './fixtures/sarif_convertor/analysis-results-without-fingerprinting.json';
import { IAnalysisResult } from '../src/interfaces/analysis-result.interface';

describe('Sarif Convertor', () => {
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
    expect(Object.keys((sarifResults.runs[0].results as any)[6].fingerprints).length).toEqual(0);

    //single fingerprinting
    expect((sarifResults.runs[0].results as any)[1].fingerprints[0]).toEqual('c8ede54bd6611ca074c42baf78809b9fe198c762ba8a1a78571befdf191869e5');
    expect((sarifResults.runs[0].results as any)[2].fingerprints[0]).toEqual('8105a5e15b9d725e663009985913a6931ba94ddd56f4854d24ba3565067501b4');
    expect((sarifResults.runs[0].results as any)[3].fingerprints[0]).toEqual('8a870ceae63c99fb925bcdcbaca7ce5c8ccf29024898cd1694d930b5d687842e');
    expect((sarifResults.runs[0].results as any)[4].fingerprints[0]).toEqual('c92fd0d8fbb0722ac17a8dfd6b9fd5c0770a64a3f965ed128ecc6ae45c20813b');
    expect((sarifResults.runs[0].results as any)[5].fingerprints[0]).toEqual('2ea8d6c4f7096751e5e6f725a3deeac983fe5fac17cdd64e5f6aa83d49156d67');
    expect((sarifResults.runs[0].results as any)[7].fingerprints[0]).toEqual('719d356d9a2efebe9142ca79825c6c0e4b0e6f5013a6e3f3b04630243416ac87');
    expect((sarifResults.runs[0].results as any)[9].fingerprints[0]).toEqual('2cc2fb05feccfae008104250873928e0d9f1de01f5878d485963f2966edc163e');
    expect((sarifResults.runs[0].results as any)[10].fingerprints[0]).toEqual('4aaff40942701a6acc92fafebea49f718bdc060012ca10a5f30e9462da6143b9');

    //2 fingerprinting
    expect((sarifResults.runs[0].results as any)[0].fingerprints[0]).toEqual('ae785dddd67d66083bf565a2ab826535bac183b3c477d249649c6596f2405dd6');
    expect((sarifResults.runs[0].results as any)[0].fingerprints[1]).toEqual('12342');

    //3 fingerprinting
    expect((sarifResults.runs[0].results as any)[8].fingerprints[0]).toEqual('78d8a8779142d82cf9be9da7a167e8e06236ab0a67d324143494650a5e4badf2');
    expect((sarifResults.runs[0].results as any)[8].fingerprints[1]).toEqual('asdf');
    expect((sarifResults.runs[0].results as any)[8].fingerprints[2]).toEqual('78d8a8779142d82cf9be9da7a167e8e06236ab0a67d324143494650a5e4badf2');

  });

  it('should contain example commit fixes', () => {
    const sarifResults = getSarif(analysisResultsWithoutFingerprinting as unknown as IAnalysisResult);
    const validationResult = jsonschema.validate(sarifResults, sarifSchema);
    expect(validationResult.errors.length).toEqual(0);

    const rules = sarifResults?.runs[0].tool?.driver?.rules;
    let exampleCommitFixes;
    if (rules !== undefined)
      exampleCommitFixes = rules[6].properties?.exampleCommitFixes;

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
    if (rules !== undefined)
      exampleCommitDescriptions = rules[0].properties?.exampleCommitDescriptions;

    expect(exampleCommitDescriptions.length).toBeGreaterThan(0);
  });
});
