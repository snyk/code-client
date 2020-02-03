import { BaseDto } from './base.dto';

export class GetFiltersResponseDto extends BaseDto<GetFiltersResponseDto> {
  readonly extensions?: string[];
  readonly configFiles?: string[];
  readonly error?: object;
}
