export interface IHeader {
  [name: string]: string;
}

export interface IHeaders {
  headers: IHeader;
}

export type ErrorResponseDto = {
  readonly statusCode: number | null;
  readonly statusText: string;
};

type ResultSuccess<T> = { type: 'success'; value: T };
type ResultError = { type: 'error'; error: ErrorResponseDto };

export type IResult<T> = ResultSuccess<T> | ResultError;
