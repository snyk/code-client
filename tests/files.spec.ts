import * as fs from 'fs';
import * as nodePath from 'path';

import {
  collectIgnoreRules,
  collectBundleFiles,
  prepareExtendingBundle,
  composeFilePayloads,
  parseFileIgnores,
  getFileInfo,
  getBundleFilePath,
  resolveBundleFilePath,
} from '../src/files';

import { sampleProjectPath, supportedFiles, bundleFiles, bundleFilesFull, bundleFileIgnores } from './constants/sample';

describe('files', () => {
  it('parse dc ignore file', () => {
    const patterns = parseFileIgnores(`${sampleProjectPath}/.dcignore`);
    expect(patterns).toEqual(bundleFileIgnores.slice(1, 10));
  });
  it('parse dot snyk file', () => {
    const patterns = parseFileIgnores(`${sampleProjectPath}/.snyk`);
    expect(patterns).toEqual(bundleFileIgnores.slice(10));
  });
  it('parse dot snyk file with only one field', () => {
    const patterns = parseFileIgnores(`${sampleProjectPath}/exclude/.snyk`);
    expect(patterns).toEqual(bundleFileIgnores.slice(12));
  });

  it('collect ignore rules', async () => {
    const ignoreRules = await collectIgnoreRules([sampleProjectPath]);
    expect(ignoreRules).toEqual(bundleFileIgnores);
  });

  it('collect bundle files', async () => {
    // TODO: We should introduce some performance test using a big enough repo to avoid flaky results
    const collector = collectBundleFiles({
      baseDir: sampleProjectPath,
      paths: [sampleProjectPath],
      supportedFiles,
      fileIgnores: bundleFileIgnores,
    });
    const files = [];
    for await (const f of collector) {
      files.push(f);
    }
    // all files in the repo are expected other than the file that exceeds MAX_FILE_SIZE 'big-file.js'
    expect(files).toEqual((await bundleFiles).filter(obj => !obj.bundlePath.includes('big-file.js')));

    const testFile = files[1];
    expect(testFile.bundlePath).toEqual('AnnotatorTest.cpp');
    expect(testFile.hash).toEqual('61b028b49c2a4513b1c7c161b5f491264fe71c9c29bc0ae8e6d760c156b45edc');
    expect(testFile.filePath).toEqual(`${sampleProjectPath}/AnnotatorTest.cpp`);
    expect(testFile.bundlePath).toEqual(`AnnotatorTest.cpp`);
    expect(testFile.size).toEqual(239);
  });

  it('extend bundle files', async () => {
    const testNewFiles = [`app.js`, `not/ignored/this_should_not_be_ignored.java`];
    const testRemovedFiles = [`removed_from_the_parent_bundle.java`, `ignored/this_should_be_ignored.java`];
    const newBundle = [...testNewFiles, ...testRemovedFiles];
    const { files, removedFiles } = await prepareExtendingBundle(
      sampleProjectPath,
      supportedFiles,
      bundleFileIgnores,
      newBundle,
    );
    expect(files).toEqual((await bundleFiles).filter(obj => testNewFiles.includes(obj.bundlePath)));
    expect(removedFiles).toEqual(['removed_from_the_parent_bundle.java']);
  });

  it('collect bundle files with multiple folders', async () => {
    // Limit size and we get fewer files
    const folders = [nodePath.join(sampleProjectPath, 'models'), nodePath.join(sampleProjectPath, 'controllers')];
    const collector = collectBundleFiles({
      baseDir: sampleProjectPath,
      paths: folders,
      supportedFiles,
      fileIgnores: [],
    });
    const smallFiles = [];
    for await (const f of collector) {
      smallFiles.push(f);
    }
    expect(smallFiles.length).toEqual(2);
    expect(smallFiles.map(f => [f.filePath, f.bundlePath])).toEqual([
      [`${sampleProjectPath}/models/sharks.js`, 'models/sharks.js'],
      [`${sampleProjectPath}/controllers/sharks.js`, 'controllers/sharks.js'],
    ]);
  });

  it('compose file payloads', async () => {
    // Prepare all missing files first
    const payloads = [...composeFilePayloads(await bundleFilesFull, 1024)];
    expect(payloads.length).toEqual(3); // 3 chunks
    expect(payloads[0].length).toEqual(2);

    const testPayload = payloads[0][1];
    expect(testPayload.filePath).toEqual(`${sampleProjectPath}/routes/sharks.js`);
    expect(testPayload.bundlePath).toEqual(`routes/sharks.js`);
    expect(testPayload.size).toEqual(363);
    expect(testPayload.hash).toEqual('f870a225bfad387cd3c46ccfb0be52415aa2e07767b53edae54c41fa8e12e82e');
    expect(testPayload.content).toEqual(fs.readFileSync(testPayload.filePath).toString('utf8'));
  });

  it('support of utf-8 encoding', async () => {
    // fs.readFileSync(payloads[0][0].path).toString('utf8')
    const filePath = `${sampleProjectPath}/app.js`;
    const fileMeta = await getFileInfo(filePath, sampleProjectPath);
    expect(fileMeta?.hash).toEqual('40f937553fda7b9986c3a87d39802b96e77fb2ba306dd602f9b2d28949316c98');
  });

  it('support of iso8859 encoding', async () => {
    const filePath = `${sampleProjectPath}/main.js`;
    const fileMeta = await getFileInfo(filePath, sampleProjectPath);
    expect(fileMeta?.hash).toEqual('3e2979852cc2e97f48f7e7973a8b0837eb73ed0485c868176bc3aa58c499f534');
  });

  it('gets correct bundle file path if no baseDir specified', () => {
    const baseDir = '';
    const darwinPath = '/Users/user/Git/goof/routes/index.js';
    expect(getBundleFilePath(darwinPath, baseDir)).toEqual(darwinPath);

    const linuxPath = '/home/user/Git/goof/routes/index.js';
    expect(getBundleFilePath(linuxPath, baseDir)).toEqual(linuxPath);

    const windowsPath = 'C:\\Users\\user\\Git\\goof\\index.js';
    expect(getBundleFilePath(windowsPath, baseDir)).toEqual(encodeURI(windowsPath));
  });

  it('resolves correct bundle file path if no baseDir specified and contains whitespace', () => {
    const baseDir = '';
    const darwinPath = '/Users/user/Git/goof%20test/routes/index.js';
    expect(resolveBundleFilePath(baseDir, darwinPath)).toEqual(decodeURI(darwinPath));

    const linuxPath = '/home/user/Git/goof%20test/routes/index.js';
    expect(resolveBundleFilePath(baseDir, linuxPath)).toEqual(decodeURI(linuxPath));

    const windowsPath = 'C:\\Users\\user\\Git\\goof%20test\\index.js';
    expect(resolveBundleFilePath(baseDir, windowsPath)).toEqual(decodeURI(windowsPath));
  });
});
