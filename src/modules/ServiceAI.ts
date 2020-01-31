import axios, { AxiosRequestConfig } from 'axios';

import { BASE_URL, API_URL } from '../config';

import { Logger } from './Logger';
import { IServiceAI } from '../interfaces/service-ai.interface';
import { IConfig } from '../interfaces/config.interface';
import { IHeader, IHeaders } from '../interfaces/http.interface';

import { StartSessionRequestDto } from '../dto/start-session.request.dto';
import { StartSessionResponseDto } from '../dto/start-session.response.dto';
import { CheckSessionRequestDto } from '../dto/check-session.request.dto';
import { CheckSessionResponseDto } from '../dto/check-session.response.dto';

export class ServiceAI implements IServiceAI {
  private baseURL = BASE_URL;
  private useDebug = false;
  private logger = new Logger(false);

  // private defaults = {
  //   options: {
  //     resolveWithFullResponse: true,
  //     json: true,
  //   },
  // };

  init(config: IConfig): void {
    this.baseURL = config.baseURL;
    this.useDebug = config.useDebug;
    this.logger.init({ useDebug: this.useDebug });
  }

  getStats(): IConfig {
    return {
      baseURL: this.baseURL,
      useDebug: this.useDebug,
    } as IConfig;
  }

  private createHeaders(sessionToken = '', useContentType = false, isUpload = false): IHeaders {
    const headers = {} as IHeader;

    if (sessionToken) {
      headers['Session-Token'] = sessionToken;
    }

    if (useContentType) {
      headers['Content-Type'] = 'application/json';
      if (isUpload) {
        headers['Content-Type'] = 'application/json;charset=utf-8';
      }
    }

    return {
      headers,
    };
  }

  async startSession(options: StartSessionRequestDto): Promise<StartSessionResponseDto> {
    const { source } = options;
    const headers = this.createHeaders(undefined, true);
    const config: AxiosRequestConfig = {
      ...headers,
      baseURL: `${this.baseURL}${API_URL}`,
      url: '/login',
      method: 'POST',
      data: {
        source,
      },
      ...headers,
    };

    this.logger.log(`HTTP ${config.method} ${config.url}:`);
    this.logger.log('=> Request: ', config);

    let response = null;
    try {
      const { body } = await axios.request(config);
      response = new StartSessionResponseDto({
        sessionToken: body.sessionToken,
        loginURL: body.loginURL,
      });
    } catch (error) {
      response = new StartSessionResponseDto({
        error,
      });
    }

    this.logger.log('<= Response: ', response);

    return Promise.resolve(response);
  }

  checkSession(options: CheckSessionRequestDto): Promise<CheckSessionResponseDto> {
    const { sessionToken } = options;
    this.logger.log('checkSession: ', { sessionToken });

    const response = new CheckSessionResponseDto({
      isLoggedIn: false,
    });
    return Promise.resolve(response);
  }
}
