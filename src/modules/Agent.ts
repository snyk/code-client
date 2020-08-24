import axios, { AxiosRequestConfig, AxiosResponse, AxiosInstance } from 'axios';
import { ERROR_CODES } from '../constants/errors';

export class Agent {
  private _axios = axios.create();

  constructor() {
    this._axios = axios.create();
  }

  public get agent(): AxiosInstance {
    this._axios.interceptors.request.use(
      config => {
        const { method, url } = config;
        console.log(`HTTP ${method?.toUpperCase()} ${url}:`);
        console.log('=> Request: ', config);

        return config;
      },
      error => {
        throw error;
      },
    );
    this._axios.interceptors.response.use(
      response => {
        console.log('<= Response: ', response);
        return response;
      },
      error => {
        console.log('error -->', error);
        if (!ERROR_CODES.has(error.statusCode)) {
          console.log('<= Response ERROR: ', error);
        }
        throw error;
      },
    );
    return this._axios;
  }

  public request(config: AxiosRequestConfig): Promise<AxiosResponse> {
    return this.agent.request(config);
  }
}
