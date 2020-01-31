import { BaseDto } from './base.dto';

export class StartSessionResponseDto extends BaseDto<StartSessionResponseDto> {
  readonly sessionToken?: string;
  readonly loginURL?: string;
  readonly error?: object;
}
