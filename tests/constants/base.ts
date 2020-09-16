
import path from 'path';

export const baseURL = 'https://www.deepcoded.com';

export const sessionToken = process.env.DEEPCODE_API_KEY || '';

export const sampleProjectPath = path.resolve(__dirname, '../sample-repo');
export const supportedFiles = {
  extensions: ['.js', '.cpp', '.java'],
  configFiles: ['.eslintrc.json'],
};

export const bundleFiles = [
  `${sampleProjectPath}/AnnotatorTest.cpp`,
  `${sampleProjectPath}/GitHubAccessTokenScrambler12.java`,
  `${sampleProjectPath}/app.js`,
  `${sampleProjectPath}/db.js`,
  `${sampleProjectPath}/main.js`,
  `${sampleProjectPath}/routes/index.js`,
  `${sampleProjectPath}/routes/sharks.js`,
];
