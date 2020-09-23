
import * as fs from 'fs';
import * as nodePath from 'path';

import { collectBundleFiles, composeFilePayloads, parseFileIgnores, getFileInfo } from '../src/files';

import { sampleProjectPath, supportedFiles, bundleFiles } from './constants/sample';

describe('files', async () => {
  it('collect bundle files', async () => {
    const collector = collectBundleFiles(sampleProjectPath, [sampleProjectPath], supportedFiles);
    const files = [];
    for await (const f of collector) {
      files.push(f);
    }

    expect(files).toEqual(await bundleFiles);

    const firstFile = files[0];
    expect(firstFile.hash).toEqual('61b028b49c2a4513b1c7c161b5f491264fe71c9c29bc0ae8e6d760c156b45edc');
    expect(firstFile.bundlePath).toEqual('/AnnotatorTest.cpp');
    expect(firstFile.filePath).toEqual(`${sampleProjectPath}/AnnotatorTest.cpp`);
    expect(firstFile.size).toEqual(239);
    expect(firstFile.content).toEqual(fs.readFileSync(firstFile.filePath).toString('utf8'));
  });

  it('collect bundle files with small max payload', async () => {
    // Limit size and we get fewer files
    const collector = collectBundleFiles(sampleProjectPath, [sampleProjectPath], supportedFiles, 500);
    const smallFiles = [];
    for await (const f of collector) {
      smallFiles.push(f);
    }
    expect(smallFiles.length).toEqual(3);
  });

  it('collect bundle files with multiple folders', async () => {
    // Limit size and we get fewer files
    const folders = [nodePath.join(sampleProjectPath, 'models'), nodePath.join(sampleProjectPath, 'controllers')];
    const collector = collectBundleFiles(sampleProjectPath, folders, supportedFiles);
    const smallFiles = [];
    for await (const f of collector) {
      smallFiles.push(f);
    }
    expect(smallFiles.length).toEqual(2);
    expect(smallFiles.map(f => [f.filePath, f.bundlePath])).toEqual([
      [`${sampleProjectPath}/models/sharks.js`, '/models/sharks.js'],
      [`${sampleProjectPath}/controllers/sharks.js`, '/controllers/sharks.js'],
    ]);
  });

  it('compose file payloads', async () => {
    // Prepare all missing files first
    const payloads = [...composeFilePayloads(await bundleFiles, 1024)];
    expect(payloads.length).toEqual(4); // 4 chunks
    expect(payloads[0].length).toEqual(3);
    expect(payloads[0][0].filePath).toEqual(`${sampleProjectPath}/AnnotatorTest.cpp`);
    expect(payloads[0][0].bundlePath).toEqual(`/AnnotatorTest.cpp`);
    expect(payloads[0][0].size).toEqual(239);
    expect(payloads[0][0].hash).toEqual('61b028b49c2a4513b1c7c161b5f491264fe71c9c29bc0ae8e6d760c156b45edc');
    expect(payloads[0][0].content).toEqual(fs.readFileSync(payloads[0][0].filePath).toString('utf8'));
  });

  it('parse dc ignore file', () => {
    const patterns = parseFileIgnores(`${sampleProjectPath}/.dcignore`);
    expect(patterns.length).toEqual(1384);
  });

  it('support of utf-8 encoding', async () => {
    // fs.readFileSync(payloads[0][0].path).toString('utf8')
    const filePath = `${sampleProjectPath}/app.js`;
    const fileMeta = await getFileInfo(filePath, sampleProjectPath);
    expect(fileMeta.hash).toEqual('577ccb10a08ec72a2a8b794b773e1d31b24b99b0e92fc0a3c2a01fef9bf820b8');
  });

  it('support of iso8859 encoding', async () => {
    const filePath = `${sampleProjectPath}/main.js`;
    const fileMeta = await getFileInfo(filePath, sampleProjectPath);
    expect(fileMeta.hash).toEqual('3e2979852cc2e97f48f7e7973a8b0837eb73ed0485c868176bc3aa58c499f534');
  });
});
