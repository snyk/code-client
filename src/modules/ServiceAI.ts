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
    };

    try {
      const { data } = await this.agent.request(config);
      return Promise.resolve(
        new StartSessionResponseDto({
          sessionToken: data.sessionToken,
          loginURL: data.loginURL,
        }),
      );
    } catch (error) {
      return Promise.resolve(
        new StartSessionResponseDto({
          error,
        }),
      );
    }
  }

  async checkSession(options: CheckSessionRequestDto): Promise<CheckSessionResponseDto> {
    const { sessionToken } = options;
    const headers = this.createHeaders(sessionToken);
    const config: AxiosRequestConfig = {
      ...headers,
      url: `/session?cache=${Math.random() * 1000000}`,
      method: 'GET',
    };

    try {
      const result = await this.agent.request(config);
      return Promise.resolve(
        new CheckSessionResponseDto({
          isLoggedIn: result.status === 200,
        }),
      );
    } catch (error) {
      const { response } = error;
      if (response && response.status === 304) {
        return Promise.resolve(
          new CheckSessionResponseDto({
            isLoggedIn: false,
          }),
        );
      }

      return Promise.resolve(
        new CheckSessionResponseDto({
          error,
        }),
      );
    }
  }
}
