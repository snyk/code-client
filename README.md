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
import { ServiceAI } from '@deepcode/tsc';

// An address of server which will be used in order to send code and analyse it.
// Default: 'https://www.deepcode.ai'.
const baseURL = 'https://www.deepcode.ai';

const AI = new ServiceAI();
```

### Requests the creation of a new login session

```javascript
const { sessionToken, loginURL } = await AI.startSession({
  baseURL,
  // An identificator for the editor using the DeepCode APIs
  source: 'atom',
});
```

### Checks status of the login process
```javascript
const { isLoggedIn } = await AI.checkSession({ baseURL, sessionToken });

// Requests current filtering options for uploaded bundles
const { extensions, configFiles } = await AI.getFilters({ baseURL, sessionToken });
```

### Create and upload bundle for Analysis
```javascript
/**
 * ServiceAI analyse method
 * Receives files and sessionToken in order to build and upload bundle
 * Parameters: AnalyseRequestDto

  {
    baseURL: string;
    sessionToken: string;
    files: string[];
    useLinters?: boolean;
  }

 */
public async analyse(options: AnalyseRequestDto): Promise<void> {}
```

### Needs to subscribe for the following events:
```javascript
/** Building bundle process started with provided data */
AI.on('buildBundleProgress', (processed: number, total: number) = {
  console.log(processed, total);
});

/** Notifies that building bundle process is completed */
AI.on('buildBundleFinish', () => {
  console.log('bundle is built');
});

/** Bundle upload process is started with provided data */
AI.on('uploadBundleProgress', (processed: number, total: number) => {
  console.log(processed, total);
});

/** Notifies that bundle upload process is completed */
AI.on('uploadBundleFinish', () => {
  console.log('upload is finished');
});

/** Analyse process is started with provided data
 *
 * interface IQueueAnalysisCheckResult {
 *    analysisResults: IAnalysisResult;
 *    analysisURL: string;
 *  }
*/
AI.on('analysisResults', (analysisResults, analysisURL) => {
  conosle.log(analysisResults, analysisURL);
});


/**
 * Notifies that analyse process is finished
 *
 * interface IQueueAnalysisCheckResult {
 *    analysisResults: IAnalysisResult;
 *    analysisURL: string;
 *  }
*/
AI.on('analyseFinish', analysisResults => {
  console.log(analysisResults);
});

/** Receives an error object and logs an error message */
AI.on('sendError', error => {
  console.log(error);
});
```

## Manual processing
If you prefer to configure ServiceAI instance manually and take the full control of the process - use the following methods

### Creates a new bundle

```javascript
const result = await AI.createBundle({
  sessionToken,
  files: {
    '/home/user/repo/main.js': '3e297985...',
    '/home/user/repo/app.js': 'c8bc6452...',
  },
});
const { bundleId, missingFiles, uploadURL } = result;
```

### Checks the status of a bundle

```javascript
const result = await AI.checkBundle({ baseURL, sessionToken, bundleId });
const { bundleId, missingFiles, uploadURL } = result;
```

### Creates a new bundle based on a previously uploaded one

```javascript
const result = await AI.extendBundle({
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

### Uploads missing files to a bundle

```javascript
const { success } = await AI.uploadFiles({
  sessionToken,
  bundleId,
  content: [
    {
      '3e297985...': 'import React from "react"...',
    },
  ],
});
```

### Starts a new bundle analysis or checks its current status and available results

```javascript
const result = await AI.getAnalysis({
  sessionToken,
  bundleId,
  useLinters: false,
});
const { status, progress, analysisURL, analysisResults } = result;
```

### Errors

If there are any errors the result of every call will contain the following:

```javascript
const { error, statusCode, statusText } = result;
```
