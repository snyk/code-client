# tsc

Typescript consumer of public API

[![deepcode](https://www.deepcode.ai/api/gh/badge?key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwbGF0Zm9ybTEiOiJnaCIsIm93bmVyMSI6IkRlZXBDb2RlQUkiLCJyZXBvMSI6InRzYyIsImluY2x1ZGVMaW50IjpmYWxzZSwiYXV0aG9ySWQiOjEyNDY5LCJpYXQiOjE1OTYwOTY3MTJ9.I7rfzfZLPc-SMEModrFPFTMbKpnCkQ5ztPzrPOdruhU)](https://www.deepcode.ai/app/gh/DeepCodeAI/tsc/_/dashboard?utm_content=gh%2FDeepCodeAI%2Ftsc)

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
const { sessionToken, loginURL } = await tsc.startSession({
  baseURL,
  // An identificator for the editor using the DeepCode APIs
  source: 'atom',
});
```

### Checks status of the login process
```javascript
const { isLoggedIn } = await tsc.checkSession({ baseURL, sessionToken });
```

### Can subscribe to the following events:
```javascript
/** Building bundle process started with provided data */
tsc.events.on('computeHashProgress', (processed: number, total: number) = {
  console.log(processed, total);
});

/** Bundle upload process is started with provided data */
tsc.events.on('uploadBundleProgress', (processed: number, total: number) => {
  console.log(processed, total);
});

/** Receives an error object and logs an error message */
tsc.events.on('sendError', error => {
  console.log(error);
});
```

### Run analysis

```javascript

const bundle = await analyzeFolders(baseURL, sessionToken, false, 1, ['/home/user/repo']);

const { analysisResults, analysisURL, bundleId } = bundle;
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

const { analysisResults, analysisURL, bundleId } = bundle;
```

### Errors

If there are any errors the result of every call will contain the following:

```javascript
const { error, statusCode, statusText } = result;
```
