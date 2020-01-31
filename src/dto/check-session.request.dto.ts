import { BaseDto } from './base.dto';

export class CheckSessionRequestDto extends BaseDto<CheckSessionRequestDto> {
  readonly sessionToken: string;
}
