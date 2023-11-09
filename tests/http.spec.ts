import { createBundle, extendBundle, getAnalysis, getVerifyCallbackUrl, ResultError } from '../src/http';
import { baseURL, source } from './constants/base';
import * as needle from '../src/needle';
import * as httpUtils from '../src/utils/httpUtils';

const jsonApiError = {
  status: '422',
  code: 'SNYK_0001',
  title: 'bad error',
  detail: 'detail',
  links: {
    about: 'https://snyk.io',
  },
};

const error = new Error('uh oh');

describe('HTTP', () => {
  const authHost = 'https://dev.snyk.io';

  beforeEach(() => {
    jest.resetModuleRegistry();
  });

  it('should respolve IPv6, if http request succeeds', async () => {
    jest.mock('needle', () =>
      jest.fn(() => ({
        response: {
          statusCode: 401,
          body: {},
        },
      })),
    );

    const http = await import('../src');
    const family = await http.getIpFamily(authHost);

    expect(family).toBe(6);
  });

  it('shouldn not resolve IPv6, if http request throws an error', async () => {
    const errorFn = () => {
      throw new Error();
    };
    jest.mock('needle', () => jest.fn(errorFn));

    const http = await import('../src');
    const family = await http.getIpFamily(authHost);

    expect(family).toBe(undefined);
  });

  it('should obtain correct verify/callback endpoint url', async () => {
    const url = getVerifyCallbackUrl(authHost);

    expect(url).toBe(`${authHost}/api/verify/callback`);
  });

  describe('getAnalysis', () => {
    const options = {
      baseURL,
      sessionToken: 'token',
      bundleHash: '123',
      severity: 1,
      source,
    };

    it('should return error on failed response', async () => {
      jest.spyOn(needle, 'makeRequest').mockResolvedValue({ success: false, errorCode: 400, error });

      const result = (await getAnalysis(options)) as ResultError<number>;

      expect(result.error.apiName).toEqual('getAnalysis');
      expect(result.error.statusText).toBeTruthy();
      expect(result.error.statusCode).toEqual(400);
    });

    it('should return error with detail for json api type errors on failed response', async () => {
      jest.spyOn(needle, 'makeRequest').mockResolvedValue({ success: false, errorCode: 422, error, jsonApiError });
      const spy = jest.spyOn(httpUtils, 'generateErrorWithDetail');

      await getAnalysis(options);

      expect(spy).toHaveBeenCalledWith(jsonApiError, 422, 'getAnalysis');
    });
  });

  describe('createBundle', () => {
    const options = {
      baseURL,
      sessionToken: 'token',
      bundleHash: '123',
      severity: 1,
      source,
      files: {},
    };

    it('should return error on failed response', async () => {
      jest.spyOn(needle, 'makeRequest').mockResolvedValue({ success: false, errorCode: 400, error });

      const result = (await createBundle(options)) as ResultError<number>;

      expect(result.error.apiName).toEqual('createBundle');
      expect(result.error.statusText).toBeTruthy();
      expect(result.error.statusCode).toEqual(400);
    });

    it('should return error with detail for json api type errors on failed response', async () => {
      jest.spyOn(needle, 'makeRequest').mockResolvedValue({ success: false, errorCode: 422, error, jsonApiError });
      const spy = jest.spyOn(httpUtils, 'generateErrorWithDetail');

      await createBundle(options);

      expect(spy).toHaveBeenCalledWith(jsonApiError, 422, 'createBundle');
    });
  });

  describe('extendBundle', () => {
    const options = {
      baseURL,
      sessionToken: 'token',
      bundleHash: '123',
      severity: 1,
      source,
      files: {},
    };

    it('should return error on failed response', async () => {
      jest.spyOn(needle, 'makeRequest').mockResolvedValue({ success: false, errorCode: 400, error });

      const result = (await extendBundle(options)) as ResultError<number>;

      expect(result.error.apiName).toEqual('extendBundle');
      expect(result.error.statusText).toBeTruthy();
      expect(result.error.statusCode).toEqual(400);
    });

    it('should return error with detail for json api type errors on failed response', async () => {
      jest.spyOn(needle, 'makeRequest').mockResolvedValue({ success: false, errorCode: 422, error, jsonApiError });
      const spy = jest.spyOn(httpUtils, 'generateErrorWithDetail');

      await extendBundle(options);

      expect(spy).toHaveBeenCalledWith(jsonApiError, 422, 'extendBundle');
    });
  });
});
