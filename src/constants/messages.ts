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