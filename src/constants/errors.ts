export const ERRORS = {
  startSession: {
    other: 'Login failed',
  },
  checkSession: {
    401: 'Missing or invalid sessionToken',
    other: 'Checking session failed',
  },
  getFilters: {
    401: 'Missing sessionToken or incomplete login process',
    other: 'Getting filters failed',
  },
  createBundle: {
    400: "Request content doesn't match the specifications",
    401: 'Missing sessionToken or incomplete login process',
    403: 'Unauthorized access to requested repository',
    404: 'Unable to resolve requested oid',
    413: 'Payload too large',
    other: 'Creating bundle failed',
  },
  checkBundle: {
    401: 'Missing sessionToken or incomplete login process',
    403: 'Unauthorized access to requested bundle',
    404: 'Uploaded bundle has expired',
    other: 'Checking bundle failed',
  },
};
