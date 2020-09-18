
import path from 'path';

export const baseURL = 'https://www.deepcoded.com';

export const sessionToken = process.env.DEEPCODE_API_KEY || '';

export const sampleProjectPath = path.resolve(__dirname, '../sample-repo');
export const supportedFiles = {
  extensions: ['.js', '.cpp', '.java'],
  configFiles: ['.eslintrc.json'],
};

export const bundleFilePaths = [
  `AnnotatorTest.cpp`,
  `GitHubAccessTokenScrambler12.java`,
  `app.js`,
  `db.js`,
  `main.js`,
  `routes/index.js`,
  `routes/sharks.js`,
];
