import path from 'path';

export const isWindows = path.sep === '\\';

// Max payload is 5 MB, but we will use 4 MB for files due to we need also to send
// another info about files with their contents
export const maxPayload = 4 * 1024 * 1024;

export const defaultBaseURL = 'https://www.deepcode.ai';
export const apiPath = '/publicapi';
