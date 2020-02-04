import { AxiosRequestConfig, AxiosError } from 'axios';

import { BASE_URL } from '../config';
import { errors } from '../constants/errors';

import { Agent } from './Agent';
import { IServiceAI } from '../interfaces/service-ai.interface';
import { IConfig } from '../interfaces/config.interface';
import { IHeader, IHeaders } from '../interfaces/http.interface';

import { ErrorResponseDto } from '../dto/error.response.dto';

import { StartSessionRequestDto } from '../dto/start-session.request.dto';
import { StartSessionResponseDto } from '../dto/start-session.response.dto';
import { CheckSessionRequestDto } from '../dto/check-session.request.dto';
import { CheckSessionResponseDto } from '../dto/check-session.response.dto';
import { GetFiltersRequestDto } from '../dto/get-filters.request.dto';
import { GetFiltersResponseDto } from '../dto/get-filters.response.dto';
import { CreateBundleRequestDto } from '../dto/create-bundle.request.dto';
import { CreateBundleResponseDto } from '../dto/create-bundle.response.dto';

type StartSessionResponse = StartSessionResponseDto | ErrorResponseDto;
type CheckSessionResponse = CheckSessionResponseDto | ErrorResponseDto;
type GetFiltersResponse = GetFiltersResponseDto | ErrorResponseDto;
type CreateBundleResponse = CreateBundleResponseDto | ErrorResponseDto;

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

  getStatusCode(error: AxiosError): number | null {
    if (!error) {
      return null;
    }

    const { response } = error;
    if (!response) {
      return null;
    }

    return response.status || null;
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

  async startSession(options: StartSessionRequestDto): Promise<StartSessionResponse> {
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
      return Promise.reject(
        new ErrorResponseDto({
          error,
          statusCode: this.getStatusCode(error),
          statusText: errors.startSession.other,
        }),
      );
    }
  }

  async checkSession(options: CheckSessionRequestDto): Promise<CheckSessionResponse> {
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

      const statusCode = this.getStatusCode(error);
      const statusText = statusCode ? errors.checkSession[statusCode] : errors.checkSession.other;
      return Promise.reject(
        new ErrorResponseDto({
          error,
          statusCode,
          statusText,
        }),
      );
    }
  }

  async getFilters(options: GetFiltersRequestDto): Promise<GetFiltersResponse> {
    const { sessionToken } = options;
    const headers = this.createHeaders(sessionToken);
    const config: AxiosRequestConfig = {
      ...headers,
      url: '/filters',
      method: 'GET',
    };

    try {
      const { data } = await this.agent.request(config);
      return Promise.resolve(new GetFiltersResponseDto(data));
    } catch (error) {
      const statusCode = this.getStatusCode(error);
      const statusText = statusCode ? errors.getFilters[statusCode] : errors.getFilters.other;

      return Promise.reject(
        new ErrorResponseDto({
          error,
          statusCode,
          statusText,
        }),
      );
    }
  }

  async createBundle(options: CreateBundleRequestDto): Promise<CreateBundleResponse> {
    const { sessionToken, files } = options;
    const headers = this.createHeaders(sessionToken);
    const config: AxiosRequestConfig = {
      ...headers,
      url: '/bundle',
      method: 'POST',
      data: {
        files,
      },
    };

    try {
      const { data } = await this.agent.request(config);
      return Promise.resolve(new CreateBundleResponseDto(data));
    } catch (error) {
      const statusCode = this.getStatusCode(error);
      const statusText = statusCode ? errors.getFilters[statusCode] : errors.getFilters.other;

      return Promise.reject(
        new ErrorResponseDto({
          error,
          statusCode,
          statusText,
        }),
      );
    }
  }
}
