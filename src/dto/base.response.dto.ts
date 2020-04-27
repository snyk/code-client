export abstract class BaseResponseDto<T> {
  readonly error?: object;
  readonly statusCode?: number | null;
  readonly statusText?: string;

  constructor(partial: Partial<T>) {
    Object.assign(this, partial);
  }
}
