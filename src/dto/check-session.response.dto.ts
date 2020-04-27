import { BaseDto } from './base.dto';

export class CheckSessionResponseDto extends BaseDto<CheckSessionResponseDto> {
  readonly isLoggedIn: boolean;
}
