import { BaseDto } from './base.dto';

export default class GetFiltersRequestDto extends BaseDto<GetFiltersRequestDto> {
  readonly baseURL: string;
  readonly sessionToken: string;
}
