import * as fs from 'fs';
import * as nodePath from 'path';
import 'jest-extended';

import {
  collectBundleFiles,
  prepareExtendingBundle,
  composeFilePayloads,
  getFileInfo,
  getBundleFilePath,
  resolveBundleFilePath,
  collectFilePolicies,
} from '../src/files';
import { getGlobPatterns } from '../src';
import { FileInfo } from '../src/interfaces/files.interface';
import {
  sampleProjectPath,
  supportedFiles,
  bundleFiles,
  bundleFilesFull,
  bundleFileIgnores,
  fileIgnoresFixtures,
  bundleFilePolicies,
} from './constants/sample';

describe('files', () => {
  it('collect bundle files', async () => {
    // TODO: We should introduce some performance test using a big enough repo to avoid flaky results
    const collector = collectBundleFiles({
      baseDir: sampleProjectPath,
      paths: [sampleProjectPath],
      supportedFiles,
      filePolicies: bundleFilePolicies,
    });
    const files: FileInfo[] = [];
    const skippedOversizedFiles: string[] = [];
    for await (const f of collector) {
      typeof f == 'string' ? skippedOversizedFiles.push(f) : files.push(f);
    }
    // all files in the repo are expected other than the file that exceeds MAX_FILE_SIZE 'big-file.js'
    const expectedFiles = (await bundleFiles).filter(obj => !obj.bundlePath.includes('big-file.js'));
    expect(files.map(f => f.filePath)).toIncludeSameMembers(expectedFiles.map(f => f.filePath)); // Assert same files in bundle
    expect(files).toIncludeSameMembers(expectedFiles); // Assert same properties for files in bundle

    // big-file.js should be added to skippedOversizedFiles
    expect(skippedOversizedFiles.length).toEqual(1);
    expect(skippedOversizedFiles[0]).toEqual('big-file.js');

    const filesWithoutBasePath = files.map(f => ({
      ...f,
      filePath: f.filePath.replace(sampleProjectPath, '<basePath>'),
    }));
    expect(filesWithoutBasePath).toMatchSnapshot();
  });

  it('collects only non-excluded files', async () => {
    const testPath = `${fileIgnoresFixtures}/negative-overrides`;
    const filePolicies = await collectFilePolicies([testPath]);
    const collector = collectBundleFiles({
      baseDir: testPath,
      paths: [testPath],
      supportedFiles,
      filePolicies,
    });
    const files: FileInfo[] = [];
    for await (const f of collector) {
      typeof f !== 'string' && files.push(f);
    }

    expect(files).toHaveLength(1);
    expect(files[0].bundlePath).toBe('.snyk');
  });

  it('extend bundle files', async () => {
    const testNewFiles = [`app.js`, `not/ignored/this_should_not_be_ignored.java`];
    const testRemovedFiles = [`removed_from_the_parent_bundle.java`];
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
      filePolicies: {
        excludes: [],
        ignores: [],
      },
    });
    const smallFiles: FileInfo[] = [];
    const skippedOversizedFiles: string[] = [];
    for await (const f of collector) {
      typeof f == 'string' ? skippedOversizedFiles.push(f) : smallFiles.push(f);
    }
    expect(smallFiles.length).toEqual(2);
    expect(skippedOversizedFiles.length).toEqual(0);
    expect(smallFiles.map(f => [f.filePath, f.bundlePath])).toEqual([
      [`${sampleProjectPath}/models/sharks.js`, 'models/sharks.js'],
      [`${sampleProjectPath}/controllers/sharks.js`, 'controllers/sharks.js'],
    ]);
  });

  it('compose file payloads', async () => {
    // Prepare all missing files first
    const payloads = [...composeFilePayloads(await bundleFilesFull, 1024)];
    expect(payloads.length).toEqual(4); // 4 chunks
    expect(payloads[0].length).toEqual(4); // 4 files in first chunk

    const testPayload = payloads[3][0];
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

  describe('getGlobPatterns', () => {
    it('generates correct glob patterns for supported files', () => {
      const globPatterns = getGlobPatterns(supportedFiles);
      expect(globPatterns).toEqual([
        '*.[jJ][sS]',
        '*.[jJ][sS][xX]',
        '*.[cC][pP][pP]',
        '*.[jJ][aA][vV][aA]',
        '.eslintrc.json',
        '.snyk',
      ]);
    });

    it("doesn't generate any pattern for an empty file extension", () => {
      const supportedFiles = {
        extensions: ['', '.cs'],
        configFiles: [],
      };
      const globPatterns = getGlobPatterns(supportedFiles);
      expect(globPatterns).toEqual(['', '*.[cC][sS]']);
    });

    it("doesn't generate any pattern for invalid file extension", () => {
      const supportedFiles = {
        extensions: ['js', '.cs'],
        configFiles: [],
      };
      const globPatterns = getGlobPatterns(supportedFiles);
      expect(globPatterns).toEqual(['', '*.[cC][sS]']);
    });

    it("doesn't generate case variant pattern for chars without case variant", () => {
      const supportedFiles = {
        extensions: ['.ps1', '.ps'],
        configFiles: [],
      };
      const globPatterns = getGlobPatterns(supportedFiles);
      expect(globPatterns).toEqual(['*.[pP][sS]1', '*.[pP][sS]']);
    });
  });
});
