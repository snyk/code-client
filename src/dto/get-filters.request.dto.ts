import { BaseDto } from './base.dto';

export class GetFiltersRequestDto extends BaseDto<GetFiltersRequestDto> {
  readonly baseURL: string;
  readonly sessionToken: string;
}
