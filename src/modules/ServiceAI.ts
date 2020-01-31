import { AxiosRequestConfig } from 'axios';

import { BASE_URL } from '../config';

import { Agent } from './Agent';
import { IServiceAI } from '../interfaces/service-ai.interface';
import { IConfig } from '../interfaces/config.interface';
import { IHeader, IHeaders } from '../interfaces/http.interface';

import { StartSessionRequestDto } from '../dto/start-session.request.dto';
import { StartSessionResponseDto } from '../dto/start-session.response.dto';
import { CheckSessionRequestDto } from '../dto/check-session.request.dto';
import { CheckSessionResponseDto } from '../dto/check-session.response.dto';

export class ServiceAI implements IServiceAI {
  private baseURL = BASE_URL;
  private agent = new Agent();

  init(config: IConfig): void {
    this.baseURL = config.baseURL;
    this.agent.init(config);
  }

  getStats(): IConfig {
    return {
      baseURL: this.baseURL,
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
      url: '/login',
      method: 'POST',
      data: {
        source,
      },
      ...headers,
    };

    let response = null;
    try {
      const { data } = await this.agent.request(config);
      response = new StartSessionResponseDto({
        sessionToken: data.sessionToken,
        loginURL: data.loginURL,
      });
    } catch (error) {
      response = new StartSessionResponseDto({
        error,
      });
    }

    return Promise.resolve(response);
  }

  checkSession(options: CheckSessionRequestDto): Promise<CheckSessionResponseDto> {
    const { sessionToken } = options;
    console.log('ServiceAI.ts, checkSession [80]: ', { sessionToken });

    const response = new CheckSessionResponseDto({
      isLoggedIn: false,
    });
    return Promise.resolve(response);
  }
}
