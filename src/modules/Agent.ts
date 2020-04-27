import axios, { AxiosRequestConfig, AxiosResponse, AxiosInstance } from 'axios';
import { Logger } from './Logger';

import { API_URL } from '../config';
import { IConfig } from '../interfaces/config.interface';

export class Agent {
  baseURL = '';
  _agent = axios.create();
  logger = new Logger(false);

  public get agent(): AxiosInstance {
    this.initAgent();
    return this._agent;
  }

  private initAgent(): void {
    this._agent = axios.create({
      baseURL: `${this.baseURL}${API_URL}`,
    });

    this._agent.interceptors.request.use(config => {
      const { method, url } = config;
      this.logger.log(`HTTP ${method?.toUpperCase()} ${url}:`);
      this.logger.log('=> Request: ', config);

      return config;
    });

    this._agent.interceptors.response.use(
      response => {
        this.logger.log('<= Response: ', response);
        return response;
      },
      error => {
        this.logger.log('<= Response ERROR: ', error);
        return Promise.reject(error);
      },
    );
  }

  public init(config: IConfig): Agent {
    this.baseURL = config.baseURL;
    this.logger.init({ useDebug: config.useDebug });
    this.initAgent();
    return this;
  }

  public async request(config: AxiosRequestConfig): Promise<AxiosResponse> {
    return this.agent.request(config);
  }
}
