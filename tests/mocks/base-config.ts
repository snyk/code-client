import { BASE_URL } from '../../src/config';
import { IConfig } from '../../src/interfaces/config.interface';

export const baseConfig: IConfig = {
  baseURL: BASE_URL,
  useDebug: false,
};

export const sessionToken = 'mock-session-token';
export const bundleId = 'mock-bundle-id';
export const expiredBundleId = 'mock-expired-bundle-id';
