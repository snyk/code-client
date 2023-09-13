import { getURL } from '../src/utils/httpUtils';

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
    const orgId = '1-2-3-4';

    const result = getURL(base, path, orgId);

    expect(result).toEqual(base + '/hidden/orgs/' + orgId + '/code' + path);
  });

  it('should throw an error if fedramp and org is missing', () => {
    const base = 'api.snykgov.io';
    const path = '/analysis';

    expect(() => getURL(base, path)).toThrowError('Org is required for this operation');
  });
});
