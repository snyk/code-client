import { CustomDCIgnore, DefaultDCIgnore } from '@deepcode/dcignore';

export const MAX_PAYLOAD = 4 * 1024 * 1024;
export const defaultBaseURL = 'https://www.deepcode.ai';
export const apiPath = '/publicapi';
export const HASH_ALGORITHM = 'sha256';
export const ENCODE_TYPE = 'hex';
export const GIT_FILENAME = '.git';
export const GITIGNORE_FILENAME = '.gitignore';
export const DCIGNORE_FILENAME = '.dcignore';
export const EXCLUDED_NAMES = [GIT_FILENAME, GITIGNORE_FILENAME, DCIGNORE_FILENAME];

export const IGNORES_DEFAULT = [`**/${GIT_FILENAME}`];

export const IGNORE_FILES_NAMES = [GITIGNORE_FILENAME, DCIGNORE_FILENAME];

export const DCIGNORE_DRAFTS = {
  custom: CustomDCIgnore,
  default: DefaultDCIgnore,
};

// // eslint-disable-next-line no-shadow
// export enum FILE_CURRENT_STATUS {
//   modified = 'modified',
//   deleted = 'deleted',
//   same = 'same',
//   created = 'created',
// }

// eslint-disable-next-line no-shadow
export enum RequestTypes {
  startSession = 'startSession',
  checkSession = 'checkSession',
  getFilters = 'getFilters',
  createBundle = 'createBundle',
  checkBundle = 'checkBundle',
  extendBundle = 'extendBundle',
  uploadFiles = 'uploadFiles',
  getAnalysis = 'getAnalysis',
  reportError = 'reportError',
  reportEvent = 'reportEvent',
}

export const ERROR_CODES = new Set([
  304, // loginInProgress,
  400, // unauthorizedContent,
  401, // unauthorizedUser,
  403, // unauthorizedBundleAccess,
  404, // notFound,
  413, // bigPayload,
  500, // serverError,
  502, // badGateway,
  503, // serviceUnavailable,
  504, // timeout,
]);

export const ERRORS = {
  [RequestTypes.startSession]: {
    other: 'Login failed',
  },
  [RequestTypes.checkSession]: {
    401: 'Missing or invalid sessionToken',
    other: 'Checking session failed',
  },
  [RequestTypes.getFilters]: {
    401: 'Missing sessionToken or incomplete login process',
    other: 'Getting filters failed',
  },
  [RequestTypes.createBundle]: {
    400: "Request content doesn't match the specifications",
    401: 'Missing sessionToken or incomplete login process',
    403: 'Unauthorized access to requested repository',
    404: 'Unable to resolve requested oid',
    413: 'Payload too large',
    other: 'Creating bundle failed',
  },
  [RequestTypes.checkBundle]: {
    401: 'Missing sessionToken or incomplete login process',
    403: 'Unauthorized access to requested bundle',
    404: 'Uploaded bundle has expired',
    other: 'Checking bundle failed',
  },
  [RequestTypes.extendBundle]: {
    400: 'Invalid request, attempted to extend a git bundle, or ended up with an empty bundle after the extension',
    401: 'Missing sessionToken or incomplete login process',
    403: 'Unauthorized access to parent bundle',
    404: 'Parent bundle has expired',
    413: 'Payload too large',
    other: 'Extending bundle failed',
  },
  [RequestTypes.uploadFiles]: {
    400: 'Invalid request, attempted to extend a git bundle, or ended up with an empty bundle after the extension',
    401: 'Missing sessionToken or incomplete login process',
    403: 'Unauthorized access to parent bundle',
    404: 'Parent bundle has expired',
    413: 'Payload too large',
    other: 'Uploading files failed',
  },
  [RequestTypes.getAnalysis]: {
    401: 'Missing sessionToken or incomplete login process',
    403: 'Unauthorized access to requested bundle',
    other: 'Getting analysis failed',
  },
  [RequestTypes.reportError]: {
    other: 'Reporting error failed',
  },
  [RequestTypes.reportEvent]: {
    other: 'Reporting event failed',
  },
};

export const BUNDLE_ERRORS = {
  create: {
    400: 'Creating bundle: Request content does not match the specifications',
    401: 'Creating bundle: Missing sessionToken or incomplete login process',
    403: 'Creating bundle: Unauthorized access to requested repository',
    413: 'Creating bundle: Payload too large',
  },
  upload: {
    400: 'Uploading files: Content and hash mismatch or attempted to upload files to a git bundle',
    401: 'Uploading files: Missing sessionToken or incomplete login process',
    403: 'Uploading files: Unauthorized access to requested bundle',
    413: 'Uploading files: Payload too large',
  },
  check: {
    401: 'Check bundle: Missing sessionToken or incomplete login process',
    403: 'Check bundle: Unauthorized access to requested bundle',
    404: 'Check bundle: Uploaded bundle has expired',
  },
  extend: {
    400: 'Extending bundle: Attempted to extend a git bundle, or ended up with an empty bundle after the extension',
    401: 'Extending bundle: Missing sessionToken or incomplete login process',
    403: 'Extending bundle: Unauthorized access to parent bundle',
    404: 'Extending bundle: Parent bundle has expired',
    413: 'Extending bundle: Payload too large',
  },
};
