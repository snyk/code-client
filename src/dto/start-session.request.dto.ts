import { BaseDto } from './base.dto';

export default class StartSessionRequestDto extends BaseDto<StartSessionRequestDto> {
  readonly baseURL: string;
  readonly source: string;
}
