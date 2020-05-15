import { BaseDto } from './base.dto';

export class StartSessionRequestDto extends BaseDto<StartSessionRequestDto> {
  readonly baseURL: string;
  readonly source: string;
}
