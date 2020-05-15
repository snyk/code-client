import axios, { AxiosRequestConfig, AxiosResponse, AxiosInstance } from 'axios';
import { Logger } from './Logger';

export class Agent {
  private _axios = axios.create();
  private logger = new Logger(false);

  constructor(useDebug = false) {
    this._axios = axios.create();
    if (useDebug) {
      this.initLogger();
    }
  }

  public get agent(): AxiosInstance {
    return this._axios;
  }

  private initLogger(): void {
    this.logger.init({ useDebug: true });

    this._axios.interceptors.request.use(config => {
      const { method, url } = config;
      this.logger.log(`HTTP ${method?.toUpperCase()} ${url}:`);
      this.logger.log('=> Request: ', config);

      return config;
    });

    this._axios.interceptors.response.use(
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

  public async request(config: AxiosRequestConfig): Promise<AxiosResponse> {
    return this.agent.request(config);
  }
}
