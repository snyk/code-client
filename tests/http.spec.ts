import needle from 'needle';

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
});
