import {
  checkBundle,
  createBundle,
  extendBundle,
  getAnalysis,
  getFilters,
  getReport,
  getVerifyCallbackUrl,
  initReport,
  ResultError,
} from '../src/http';
import { baseURL, source } from './constants/base';
import * as needle from '../src/needle';
import * as httpUtils from '../src/utils/httpUtils';
import { FilterArgs } from '../src/http';

const jsonApiError = {
  status: '422',
  code: 'SNYK_0001',
  title: 'bad error',
  detail: 'detail',
  links: {
    about: 'https://snyk.io',
  },
  meta: {
    isErrorCatalogError: true,
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

  describe('getFilters', () => {
    it('should return error on failed response', async () => {
      jest.spyOn(needle, 'makeRequest').mockResolvedValue({ success: false, errorCode: 500, error });

      const result = (await getFilters({ baseURL, source, attempts: 1, extraHeaders: {} })) as ResultError<number>;

      expect(result.error.apiName).toEqual('filters');
      expect(result.error.statusText).toBeTruthy();
      expect(result.error.statusCode).toEqual(500);
    });

    it('should return error with detail for json api type errors on failed response', async () => {
      jest
        .spyOn(needle, 'makeRequest')
        .mockResolvedValue({ success: false, errorCode: 422, error, errors: [jsonApiError] });
      const spy = jest.spyOn(httpUtils, 'generateErrorWithDetail');

      await getFilters({ baseURL, source, attempts: 1, extraHeaders: {} });

      expect(spy).toHaveBeenCalledWith(jsonApiError, 422, 'filters');
    });
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
      jest
        .spyOn(needle, 'makeRequest')
        .mockResolvedValue({ success: false, errorCode: 422, error, errors: [jsonApiError] });
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
      jest
        .spyOn(needle, 'makeRequest')
        .mockResolvedValue({ success: false, errorCode: 422, error, errors: [jsonApiError] });
      const spy = jest.spyOn(httpUtils, 'generateErrorWithDetail');

      await createBundle(options);

      expect(spy).toHaveBeenCalledWith(jsonApiError, 422, 'createBundle');
    });
  });

  describe('checkBundle', () => {
    const options = {
      baseURL,
      sessionToken: 'token',
      bundleHash: '123',
      severity: 1,
      source,
      files: {},
    };

    it('should return error on failed response', async () => {
      jest.spyOn(needle, 'makeRequest').mockResolvedValue({ success: false, errorCode: 404, error });

      const result = (await checkBundle(options)) as ResultError<number>;

      expect(result.error.apiName).toEqual('checkBundle');
      expect(result.error.statusText).toBeTruthy();
      expect(result.error.statusCode).toEqual(404);
    });

    it('should return error with detail for json api type errors on failed response', async () => {
      jest
        .spyOn(needle, 'makeRequest')
        .mockResolvedValue({ success: false, errorCode: 422, error, errors: [jsonApiError] });
      const spy = jest.spyOn(httpUtils, 'generateErrorWithDetail');

      await checkBundle(options);

      expect(spy).toHaveBeenCalledWith(jsonApiError, 422, 'checkBundle');
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
      jest
        .spyOn(needle, 'makeRequest')
        .mockResolvedValue({ success: false, errorCode: 422, error, errors: [jsonApiError] });
      const spy = jest.spyOn(httpUtils, 'generateErrorWithDetail');

      await extendBundle(options);

      expect(spy).toHaveBeenCalledWith(jsonApiError, 422, 'extendBundle');
    });
  });

  describe('initReport', () => {
    const options = {
      baseURL,
      sessionToken: 'token',
      bundleHash: '123',
      source,
      report: {
        enabled: true,
      },
    };

    it('should return error on failed response', async () => {
      jest.spyOn(needle, 'makeRequest').mockResolvedValue({ success: false, errorCode: 400, error });

      const result = (await initReport(options)) as ResultError<number>;

      expect(result.error.apiName).toEqual('initReport');
      expect(result.error.statusText).toBeTruthy();
      expect(result.error.statusCode).toEqual(400);
    });

    it('should return error with detail for json api type errors on failed response', async () => {
      jest
        .spyOn(needle, 'makeRequest')
        .mockResolvedValue({ success: false, errorCode: 422, error, errors: [jsonApiError] });
      const spy = jest.spyOn(httpUtils, 'generateErrorWithDetail');

      await initReport(options);

      expect(spy).toHaveBeenCalledWith(jsonApiError, 422, 'initReport');
    });
  });

  describe('getReport', () => {
    const options = {
      baseURL,
      sessionToken: 'token',
      source,
      pollId: '1',
    };

    it('should return error on failed response', async () => {
      jest.spyOn(needle, 'makeRequest').mockResolvedValue({ success: false, errorCode: 400, error });

      const result = (await getReport(options)) as ResultError<number>;

      expect(result.error.apiName).toEqual('getReport');
      expect(result.error.statusText).toBeTruthy();
      expect(result.error.statusCode).toEqual(400);
    });

    it('should return error with detail for json api type errors on failed response', async () => {
      jest
        .spyOn(needle, 'makeRequest')
        .mockResolvedValue({ success: false, errorCode: 422, error, errors: [jsonApiError] });
      const spy = jest.spyOn(httpUtils, 'generateErrorWithDetail');

      await getReport(options);

      expect(spy).toHaveBeenCalledWith(jsonApiError, 422, 'getReport');
    });
  });
});
