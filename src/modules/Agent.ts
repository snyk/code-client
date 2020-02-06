import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Logger } from './Logger';

import { BASE_URL, API_URL } from '../config';
import { IConfig } from '../interfaces/config.interface';

const defaultURL = `${BASE_URL}${API_URL}`;

export class Agent {
  private baseURL = BASE_URL;
  private agent = axios.create({ baseURL: defaultURL });
  private logger = new Logger(false);

  private initAgent(): void {
    this.agent = axios.create({
      baseURL: `${this.baseURL}${API_URL}`,
    });

    this.agent.interceptors.request.use(config => {
      const { method, url } = config;
      this.logger.log(`HTTP ${method?.toUpperCase()} ${url}:`);
      this.logger.log('=> Request: ', config);

      return config;
    });

    this.agent.interceptors.response.use(
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

  public init(config: IConfig): void {
    this.baseURL = config.baseURL;
    this.logger.init({ useDebug: config.useDebug });
    this.initAgent();
  }

  public async request(config: AxiosRequestConfig): Promise<AxiosResponse> {
    return this.agent.request(config);
  }
}
