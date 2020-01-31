import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Logger } from './Logger';

import { BASE_URL, API_URL } from '../config';
import { IConfig } from '../interfaces/config.interface';

export class Agent {
  private baseURL = BASE_URL;
  private useDebug = false;

  private agent = axios.create({
    baseURL: `${BASE_URL}${API_URL}`,
  });
  private logger = new Logger(false);

  init(config: IConfig): void {
    this.baseURL = config.baseURL;
    this.useDebug = config.useDebug;

    this.logger.init({ useDebug: this.useDebug });
    this.initAgent();
  }

  initAgent() {
    this.agent = axios.create({
      baseURL: `${this.baseURL}${API_URL}`,
    });

    this.agent.interceptors.request.use(config => {
      const { method, url } = config;
      this.logger.log(`HTTP ${method} ${url}:`);
      this.logger.log('=> Request: ', config);

      return config;
    });

    this.agent.interceptors.response.use(
      (response) => {
        this.logger.log('<= Response: ', response);
        return response;
      },
      (error) => {
        this.logger.log('<= Response ERROR: ', error);
        return Promise.reject(error);
      },
    );
  }

  async request(config: AxiosRequestConfig): Promise<AxiosResponse> {
    return this.agent.request(config);
  }
}
