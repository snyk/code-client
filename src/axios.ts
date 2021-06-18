import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import http from 'http';
import https from 'https';
import emitter from './emitter';

// Snyk CLI allow passing --insecure flag which allows self-signed certificates
// It updates global namespace property ignoreUnknownCA and we can use it in order
// to pass rejectUnauthorized option to https agent
export declare interface Global extends NodeJS.Global {
  ignoreUnknownCA: boolean;
}
declare const global: Global;

export const agentOptions = {
  keepAlive: true,
  maxSockets: 100, // Maximum number of sockets to allow per host. Defaults to Infinity.
  maxFreeSockets: 10,
  freeSocketTimeout: 60000, // // Maximum number of sockets to leave open for 60 seconds in a free state. Only relevant if keepAlive is set to true. Defaults to 256.
  socketActiveTTL: 1000 * 60 * 10,
  rejectUnauthorized: !global.ignoreUnknownCA,
};

const defaultRequestConfig: AxiosRequestConfig = {
  responseType: 'json',
  headers: {
    'Content-Type': 'application/json;charset=utf-8',
  },
  // keepAlive pools and reuses TCP connections, so it's faster
  httpAgent: new http.Agent(agentOptions),
  httpsAgent: new https.Agent(agentOptions),
  proxy: false,
};

const axios_ = axios.create(defaultRequestConfig);

axios_.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { method, url, data } = config;
    emitter.apiRequestLog(`=> HTTP ${method?.toUpperCase()} ${url} ${data ? JSON.stringify(data) : ''}`.slice(0, 399));
    return config;
  },
  (error: AxiosError) => {
    emitter.apiRequestLog(`Request error --> ${error.message}`);
    throw error;
  },
);

axios_.interceptors.response.use(
  (response: AxiosResponse) => {
    emitter.apiRequestLog(`<= Response: ${response.status} ${JSON.stringify(response.data)}`.slice(0, 399));
    return response;
  },
  (error: AxiosError) => {
    emitter.apiRequestLog(`Response error --> ${error.message}`);
    throw error;
  },
);

export function createCustomAgentAxios(options: https.AgentOptions & https.AgentOptions) {
  const config = {
    ...defaultRequestConfig,
    httpAgent: new http.Agent(options),
    httpsAgent: new https.Agent(options),
  };

  return axios.create(config);
}

export default axios_;
