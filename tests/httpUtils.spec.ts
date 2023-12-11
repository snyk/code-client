import { generateErrorWithDetail, getURL } from '../src/utils/httpUtils';

describe('getURL', () => {
  it('should return base + path if not fedramp', () => {
    const base = 'api.dev.snyk.io';
    const path = '/analysis';

    const result = getURL(base, path);

    expect(result).toEqual(base + path);
  });

  it('should return base + org routing + path if fedramp', () => {
    const base = 'api.snykgov.io';
    const path = '/analysis';
    const orgId = '12345678-1234-1234-1234-1234567890ab';

    const result = getURL(base, path, orgId);

    expect(result).toEqual(base + '/hidden/orgs/' + orgId + '/code' + path);
  });

  it('should throw an error if fedramp and org is missing', () => {
    const base = 'api.snykgov.io';
    const path = '/analysis';

    expect(() => getURL(base, path)).toThrowError('A valid Org id is required for this operation');
  });

  it('should throw an error if fedramp and org is invalid', () => {
    const base = 'api.snykgov.io';
    const path = '/analysis';
    const orgId = '1-2-3-4';

    expect(() => getURL(base, path, orgId)).toThrowError('A valid Org id is required for this operation');
  });
});

describe('generateErrorWithDetail', () => {
  it('should return detail with link', () => {
    const jsonApiError = {
      status: '422',
      code: 'SNYK-CODE-0001',
      title: 'bad error',
      detail: 'detail',
      links: {
        about: 'https://snyk.io',
      },
      meta: {
        isErrorCatalogError: true,
      },
    };

    expect(generateErrorWithDetail(jsonApiError, 422, 'test')).toEqual({
      type: 'error',
      error: {
        apiName: 'test',
        statusCode: 422,
        statusText: 'bad error',
        detail: 'bad error: detail (more info: https://snyk.io)',
      },
    });
  });

  it('should return detail with no link if not present', () => {
    const jsonApiError = {
      status: '422',
      code: 'SNYK-CODE-0001',
      title: 'bad error',
      detail: 'detail',
      meta: {
        isErrorCatalogError: true,
      },
    };

    expect(generateErrorWithDetail(jsonApiError, 422, 'test')).toEqual({
      type: 'error',
      error: {
        apiName: 'test',
        statusCode: 422,
        statusText: 'bad error',
        detail: 'bad error: detail',
      },
    });
  });

  it('should return detail with title and link when detail is empty string', () => {
    const jsonApiError = {
      status: '422',
      code: 'SNYK-CODE-0001',
      title: 'bad error',
      detail: '',
      links: {
        about: 'https://snyk.io',
      },
      meta: {
        isErrorCatalogError: true,
      },
    };

    expect(generateErrorWithDetail(jsonApiError, 422, 'test')).toEqual({
      type: 'error',
      error: {
        apiName: 'test',
        statusCode: 422,
        statusText: 'bad error',
        detail: 'bad error (more info: https://snyk.io)',
      },
    });
  });

  it('should return detail with title when detail is empty string and no link', () => {
    const jsonApiError = {
      status: '422',
      code: 'SNYK-CODE-0001',
      title: 'bad error',
      detail: '',
      meta: {
        isErrorCatalogError: true,
      },
    };

    expect(generateErrorWithDetail(jsonApiError, 422, 'test')).toEqual({
      type: 'error',
      error: {
        apiName: 'test',
        statusCode: 422,
        statusText: 'bad error',
        detail: 'bad error',
      },
    });
  });
});
