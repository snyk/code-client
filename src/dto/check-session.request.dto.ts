import { BaseDto } from './base.dto';

export default class CheckSessionRequestDto extends BaseDto<CheckSessionRequestDto> {
  readonly baseURL: string;
  readonly sessionToken: string;
}
