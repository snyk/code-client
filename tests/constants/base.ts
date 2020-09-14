import path from 'path';

export const bundleId = 'gh/Arvi3d/DEEPCODE_PRIVATE_BUNDLE/8743ef6f5ade7158b72e39ba10a01be4408d52efd27d841afcb162a8a46156ba';

export const sessionToken = process.env.DEEPCODE_API_KEY || '';

// export const bundleUploadURL = `https://www.deepcode.ai/publicapi/file/${bundleId}`;

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
