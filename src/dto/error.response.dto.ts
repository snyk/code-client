import { AxiosError } from 'axios';

type ErrorResponseDto = {
  readonly error: AxiosError;
  readonly statusCode: number | null;
  readonly statusText: string;
};

export default ErrorResponseDto;
