# tsc
Typescript consumer of public API

# Installation

```shell script
$ npm install --save @deepcode/tsc
```

# Usage

### Creates and initializes an instance

```javascript
import { ServiceAI } from '@deepcode/tsc';

const config = {
  // An address of server which will be used in order to send code and analyse it.
  // Required field.
  // Default: 'https://www.deepcode.ai'.
  baseURL: 'https://www.deepcode.ai',

  // Allows output debug messages to console.
  // Optional field.
  // Default: false.
  useDebug: true
}

const AI = new ServiceAI();

// Initialization of the service
// You may init the service at any moment you want
AI.init(config);
```

### Requests the creation of a new login session

```javascript
const { sessionToken, loginURL } = await AI.startSession({
  // An identificator for the editor using the DeepCode APIs
  source: 'atom',
});
```

### Checks status of the login process
```javascript
const { isLoggedIn } = await AI.checkSession({ sessionToken });

// Requests current filtering options for uploaded bundles
const { extensions, configFiles } = await AI.getFilters({ sessionToken });
```

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
const result = await AI.checkBundle({
  sessionToken,
  bundleId,
});
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
  content: [{
    '3e297985...': 'import React from "react"...',
  }],
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
