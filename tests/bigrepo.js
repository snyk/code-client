const codeClient = require('../dist/index');

const baseURL = 'https://www.deepcoded.com';
const sessionToken = ''; // PUT YOUR STAGING SESSION TOKEN HERE
const registryPath = ''; // PUT YOUR LOCAL REGISTRY PATH HERE

codeClient.emitter.on('scanFilesProgress', (processed) => {
  console.log(`Indexed ${processed} files`);
});

/** Bundle upload process is started with provided data */
codeClient.emitter.on('uploadBundleProgress', (processed, total) => {
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

const bundle = codeClient.analyzeFolders({
  baseURL,
  sessionToken,
  includeLint: false,
  severity: 1,
  paths: [registryPath],
  sarif: true,
  source: 'test',
}).catch(console.error);