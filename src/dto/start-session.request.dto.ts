import { BaseDto } from './base.dto';

export class StartSessionRequestDto extends BaseDto<StartSessionRequestDto> {
  readonly source: string;
}
