import { AxiosError, AxiosRequestConfig } from 'axios';

import { Agent } from '../src/modules/Agent';
import { startMockServer } from './mocks/mock-server';
import { baseConfig } from './mocks/base-config';

startMockServer();

describe('Agent', () => {
  let agent: Agent;

  beforeEach(() => {
    agent = new Agent();
    agent.init(baseConfig);
  })

  it('creates and initializes an instance', () => {
    expect(agent).toBeInstanceOf(Agent);
  });

  it('makes successful request', async () => {
    const config: AxiosRequestConfig = {
      url: '/agent-response',
      method: 'GET',
    };
    const mockData = {
      name: 'agent',
    };

    const { data } = await agent.request(config);

    expect(data).toEqual(mockData);
  });

  it('makes unsuccessful request', async () => {
    const config: AxiosRequestConfig = {
      url: '/agent-error',
      method: 'GET',
    };

    let result: AxiosError;
    try {
      await agent.request(config);
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
