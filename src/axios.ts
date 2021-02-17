import axios, { AxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';
import { LOGGING } from './constants';
import emitter from './emitter';
const { NODE_ENV } = process.env;

const axios_ = axios.create({
  responseType: 'json',
  headers: {
    'Content-Type': 'application/json;charset=utf-8',
  },
});

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

export default axios_;
