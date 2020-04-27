import { RequestTypes } from '../enums/request-types.enum';

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
};
