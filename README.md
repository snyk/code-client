# code-client

Typescript consumer of public API

[![npm version](https://img.shields.io/npm/v/@snyk/code-client.svg?style=flat-square)](https://www.npmjs.org/package/@snyk/code-client)
[![npm downloads](https://img.shields.io/npm/dm/@snyk/code-client.svg?style=flat-square)](http://npm-stat.com/charts.html?package=@snyk/code-client)

# Installation

```shell script
$ npm install --save @snyk/code-client
```

# Usage

### Creates and initializes an instance

```javascript
import codeClient from '@snyk/code-client';

// An address of server which will be used in order to send code and analyse it.
const baseURL = 'https://www.snyk.io';
```

### Requests the creation of a new login session

```javascript
const loginResponse = await codeClient.startSession({
  baseURL,
  // An identificator for the editor using the Snyk APIs
  source: 'atom',
});

if (loginResponse.type === 'error') {
  // Handle error and alert user
}

const { sessionToken, loginURL } = loginResponse.value;
```

### Checks status of the login process

```javascript
const sessionResponse = await codeClient.checkSession({ baseURL, sessionToken });
if (sessionResponse.type === 'error') {
  // Handle error and alert user
}

const isLoggedIn = sessionResponse.value; // boolean
```

### Subscribe to events.

```javascript
/** Building bundle process started with provided data */
codeClient.emitter.on('scanFilesProgress', (processed: number) = {
  console.log(`Indexed ${processed} files`);
});

/** Bundle upload process is started with provided data */
codeClient.emitter.on('uploadBundleProgress', (processed: number, total: number) => {
  console.log(`Upload bundle progress: ${processed}/${total}`);
});

/** Receives an error object and logs an error message */
codeClient.emitter.on('sendError', error => {
  console.log(error);
});

/** Logs HTTP requests sent to the API **/
codeClient.emitter.on('apiRequestLog', (message) => {
  console.log(message);
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
const bundle = await codeClient.analyzeFolders({
  baseURL,
  sessionToken,
  severity: 1,
  paths: ['/home/user/repo'],
  sarif,
  source,
});

// bundle implements interface FileBundle:
//   readonly baseURL: string;
//   readonly sessionToken: string;
//   readonly severity: AnalysisSeverity;
//   readonly bundleHash: string;
//   readonly analysisResults: IAnalysisResult;
//   readonly baseDir: string;
//   readonly paths: string[];
//   readonly supportedFiles: SupportedFiles;
```

### Creates a new bundle based on a previously uploaded one

```javascript
const result = await codeClient.extendBundle({
  sessionToken,
  bundleHash,
  files: {
    '/home/user/repo/main.js': '3e297985...',
    '/home/user/repo/app.js': 'c8bc6452...',
  },
  removedFiles: [],
});
const { bundleHash, missingFiles, uploadURL } = result;
```

### Errors

If there are any errors the result of every call will contain the following:

```javascript
const { error, statusCode, statusText } = result;
```
