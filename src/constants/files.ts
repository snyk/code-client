export const CRYPTO = {
  algorithm: 'sha256',
  hashEncode: 'hex',
};

export const HASH_ALGORITHM = 'sha256';
export const ENCODE_TYPE = 'hex';
export const GIT_FILENAME = '.git';
export const GITIGNORE_FILENAME = '.gitignore';
export const DCIGNORE_FILENAME = '.dcignore';
export const EXCLUDED_NAMES = [GIT_FILENAME, GITIGNORE_FILENAME, DCIGNORE_FILENAME];
export const ALLOWED_PAYLOAD_SIZE = 1024 * 1024 * 4; // max payload size of 4MB in bytes

export const FILE_CURRENT_STATUS = {
  modified: 'modified',
  deleted: 'deleted',
  same: 'same',
  created: 'created',
};
