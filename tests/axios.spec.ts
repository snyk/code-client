import { AxiosError, AxiosRequestConfig } from 'axios';

import axios from '../src/modules/axios';
import startMockServer from './mocks/mock-server';

import { defaultBaseURL as baseURL, apiPath } from '../src/constants/common';

startMockServer();

describe('axios', () => {
  it('makes successful request', async () => {
    const config: AxiosRequestConfig = {
      url: `${baseURL}${apiPath}/agent-response`,
      method: 'GET',
    };
    const mockData = {
      name: 'agent',
    };

    const { data } = await axios.request(config);

    expect(data).toEqual(mockData);
  });

  it('makes unsuccessful request', async () => {
    const config: AxiosRequestConfig = {
      url: `${baseURL}${apiPath}/agent-error`,
      method: 'GET',
    };

    let result: AxiosError;
    try {
      await axios.request(config);
      result = {
        config,
        isAxiosError: true,
      } as AxiosError;
    } catch (error) {
      result = error;
    }

    expect(result.response?.status).toEqual(404);
  });
});
