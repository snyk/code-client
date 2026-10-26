import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { collectBundleFiles, prepareExtendingBundle } from '../src/files';
import { MAX_FILE_SIZE } from '../src/constants';

describe('file discovery compatibility', () => {
  let directory: string;
  const supportedFiles = { extensions: ['.js'], configFiles: [] };

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(tmpdir(), 'code-client-glob-'));
    fs.mkdirSync(path.join(directory, 'nested'));
    fs.writeFileSync(path.join(directory, 'regular.js'), 'const regular = true;');
    fs.writeFileSync(path.join(directory, '.hidden.js'), 'const hidden = true;');
    fs.writeFileSync(path.join(directory, 'nested', 'inner.js'), 'const inner = true;');
    fs.symlinkSync('regular.js', path.join(directory, 'linked.js'));
    fs.symlinkSync('nested', path.join(directory, 'linked-directory'));
    fs.mkdirSync(path.join(directory, 'directory.js'));
  });

  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  it.each([false, true])('respects symlinksEnabled=%s during discovery', async symlinksEnabled => {
    const files: string[] = [];
    for await (const file of collectBundleFiles({
      baseDir: directory,
      paths: [directory],
      supportedFiles,
      filePolicies: { excludes: [], ignores: [] },
      symlinksEnabled,
    })) {
      if (typeof file !== 'string') files.push(file.bundlePath);
    }
    const expected = ['regular.js', '.hidden.js', 'nested/inner.js'];
    if (symlinksEnabled) expected.push('linked.js', 'linked-directory/inner.js');
    expect(files.sort()).toEqual(expected.sort());
  });

  it('uses the target size when extending a bundle with a symlink', async () => {
    const largePath = path.join(directory, 'large.js');
    fs.writeFileSync(largePath, '');
    fs.truncateSync(largePath, MAX_FILE_SIZE + 1);
    fs.symlinkSync('large.js', path.join(directory, 'linked-large.js'));
    const result = await prepareExtendingBundle(directory, supportedFiles, [], ['linked-large.js'], true);
    expect(result.files).toEqual([]);
    expect(result.removedFiles).toEqual(['linked-large.js']);
  });
});
