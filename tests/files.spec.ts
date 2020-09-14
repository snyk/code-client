
import * as fs from 'fs';

import { collectBundleFiles, prepareBundleHashes, prepareFilePath, composeFilePayloads, parseFileIgnores, getFileMeta } from '../src/files';

import { sampleProjectPath, supportedFiles, bundleFiles } from './constants/base';

describe('files', () => {

  it('collect bundle files', async () => {
    const bundleFiles = collectBundleFiles([sampleProjectPath], supportedFiles);
    expect(bundleFiles).toEqual(bundleFiles);
  });

  it('prepare bundle hashes', async () => {
    const filesData = [...prepareBundleHashes(bundleFiles)];
    expect(filesData.length).toEqual(7);
    expect(filesData[0].hash).toEqual('61b028b49c2a4513b1c7c161b5f491264fe71c9c29bc0ae8e6d760c156b45edc');
    expect(filesData[0].path).toEqual(`${sampleProjectPath}/AnnotatorTest.cpp`);
    expect(filesData[0].size).toEqual(239);
    expect(filesData[0].content).toEqual(fs.readFileSync(filesData[0].path).toString('utf8'));

    // Limit size and we get fewer files
    const smallFiles = [...prepareBundleHashes(bundleFiles, 500)];
    expect(smallFiles.length).toEqual(3);
  });

  // TODO: refactor it with relative path
  it('prepare file path', () => {
    const relpath = prepareFilePath(`${sampleProjectPath}/AnnotatorTest.cpp`);
    expect(relpath).toEqual(`/${sampleProjectPath}/AnnotatorTest.cpp`);
  });

  it('compose file payloads', () => {

    // Prepare all missing files first
    const missingFiles = bundleFiles.map(prepareFilePath);

    const payloads = [...composeFilePayloads(missingFiles, 1024)];
    expect(payloads.length).toEqual(4); // 4 chunks
    expect(payloads[0].length).toEqual(3);
    expect(payloads[0][0].path).toEqual(`${sampleProjectPath}/AnnotatorTest.cpp`);
    expect(payloads[0][0].size).toEqual(239);
    expect(payloads[0][0].hash).toEqual('61b028b49c2a4513b1c7c161b5f491264fe71c9c29bc0ae8e6d760c156b45edc');
    expect(payloads[0][0].content).toEqual(fs.readFileSync(payloads[0][0].path).toString('utf8'));
  });

  it('parse dc ignore file', () => {
    const patterns = parseFileIgnores(`${sampleProjectPath}/.dcignore`);
    expect(patterns.length).toEqual(1384);
  });

  it('support of utf-8 encoding', () => {
    // fs.readFileSync(payloads[0][0].path).toString('utf8')
    const filePath = `${sampleProjectPath}/app.js`;
    const fileMeta = getFileMeta(filePath);
    expect(fileMeta.hash).toEqual('577ccb10a08ec72a2a8b794b773e1d31b24b99b0e92fc0a3c2a01fef9bf820b8');
  });

  it('support of iso8859 encoding', () => {
    const filePath = `${sampleProjectPath}/main.js`;
    const fileMeta = getFileMeta(filePath);
    expect(fileMeta.hash).toEqual('3e2979852cc2e97f48f7e7973a8b0837eb73ed0485c868176bc3aa58c499f534');
  });

});
