# tsc

Typescript consumer of public API

[![deepcode](https://www.deepcode.ai/api/gh/badge?key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwbGF0Zm9ybTEiOiJnaCIsIm93bmVyMSI6IkRlZXBDb2RlQUkiLCJyZXBvMSI6InRzYyIsImluY2x1ZGVMaW50IjpmYWxzZSwiYXV0aG9ySWQiOjEyNDY5LCJpYXQiOjE1OTYwOTY3MTJ9.I7rfzfZLPc-SMEModrFPFTMbKpnCkQ5ztPzrPOdruhU)](https://www.deepcode.ai/app/gh/DeepCodeAI/tsc/_/dashboard?utm_content=gh%2FDeepCodeAI%2Ftsc)

[![npm version](https://img.shields.io/npm/v/@deepcode/tsc.svg?style=flat-square)](https://www.npmjs.org/package/@deepcode/tsc)
[![npm downloads](https://img.shields.io/npm/dm/@deepcode/tsc.svg?style=flat-square)](http://npm-stat.com/charts.html?package=@deepcode/tsc)

# Installation

```shell script
$ npm install --save @deepcode/tsc
```

# Usage

### Creates and initializes an instance

```javascript
import tsc from '@deepcode/tsc';

// An address of server which will be used in order to send code and analyse it.
// Default: 'https://www.deepcode.ai'.
const baseURL = 'https://www.deepcode.ai';

```

### Requests the creation of a new login session

```javascript
const loginResponse = await tsc.startSession({
  baseURL,
  // An identificator for the editor using the DeepCode APIs
  source: 'atom',
});

if (loginResponse.type === 'error') {
  // Handle error and alert user
}

const { sessionToken, loginURL } = loginResponse.value;
```

### Checks status of the login process
```javascript
const sessionResponse = await tsc.checkSession({ baseURL, sessionToken });
if (sessionResponse.type === 'error') {
  // Handle error and alert user
}

const isLoggedIn = sessionResponse.value; // boolean
```

### Subscribe to events.

```javascript
/** Building bundle process started with provided data */
tsc.emitter.on('scanFilesProgress', (processed: number) = {
  console.log(`Indexed ${processed} files`);
});

/** Bundle upload process is started with provided data */
tsc.emitter.on('uploadBundleProgress', (processed: number, total: number) => {
  console.log(`Upload bundle progress: ${processed}/${total}`);
});

/** Receives an error object and logs an error message */
tsc.emitter.on('sendError', error => {
  console.log(error);
});
```

Complete list of events:
  - supportedFilesLoaded: uploading supported file extensions, can be also used for instantiating file watcher
  - scanFilesProgress: emits a number of files being found
  - createBundleProgress: emits a progress in instantiating packages for analysis
  - uploadBundleProgress: emits a progress in uploading files
  - analyseProgress: emits a progress in analysis job
  - error: emits in case of an error

### Run analysis

```javascript
const bundle = await tsc.analyzeFolders(baseURL, sessionToken, false, 1, ['/home/user/repo']);

// bundle implements interface IFileBundle:
//   readonly baseURL: string;
//   readonly sessionToken: string;
//   readonly includeLint: boolean;
//   readonly severity: AnalysisSeverity;
//   readonly bundleId: string;
//   readonly analysisResults: IAnalysisResult;
//   readonly analysisURL: string;
//   readonly baseDir: string;
//   readonly paths: string[];
//   readonly supportedFiles: ISupportedFiles;
```

### Creates a new bundle based on a previously uploaded one

```javascript
const result = await tsc.extendBundle({
  sessionToken,
  bundleId,
  files: {
    '/home/user/repo/main.js': '3e297985...',
    '/home/user/repo/app.js': 'c8bc6452...',
  },
  removedFiles: [],
});
const { bundleId, missingFiles, uploadURL } = result;
```

### Run analysis of remote git repository

```javascript

const bundle = await analyzeGit(baseURL, sessionToken, false, 1, 'git@github.com:DeepCodeAI/cli.git@320d98a6896f5376efe6cefefb6e70b46b97d566');

// bundle implements interface IGitBundle
//   readonly baseURL: string;
//   readonly sessionToken: string;
//   readonly includeLint: boolean;
//   readonly severity: AnalysisSeverity;
//   readonly bundleId: string;
//   readonly analysisResults: IAnalysisResult;
//   readonly analysisURL: string;
//   readonly gitUri: string;
```

### Errors

If there are any errors the result of every call will contain the following:

```javascript
const { error, statusCode, statusText } = result;
```
