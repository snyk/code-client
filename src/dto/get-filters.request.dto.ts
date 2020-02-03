import { BaseDto } from './base.dto';

export class GetFiltersRequestDto extends BaseDto<GetFiltersRequestDto> {
  readonly sessionToken: string;
}
