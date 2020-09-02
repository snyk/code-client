export interface IErrorResponse {
  readonly error: object;
  readonly statusCode: number | null;
  readonly statusText: string;
}

export class ErrorResponseDto implements IErrorResponse {
  readonly error: object;
  readonly statusCode: number | null;
  readonly statusText: string;

  constructor(partial: Partial<IErrorResponse>) {
    Object.assign(this, partial);
  }
}
