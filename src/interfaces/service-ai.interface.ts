import { IConfig } from './config.interface';

// import { StartSessionResponseDto } from '../dto/start-session.response.dto';
// import { StartSessionRequestDto } from '../dto/start-session.request.dto';
// import { CheckSessionRequestDto } from '../dto/check-session.request.dto';
// import { CheckSessionResponseDto } from '../dto/check-session.response.dto';

export interface IServiceAI {
  /**
   * Initialization of service
   * @param config
   */
  init(config: IConfig): void;

  /**
   * Requests the creation of a new login session
   * @param options
   */
  // startSession(options: StartSessionRequestDto): Promise<StartSessionResponseDto>;

  /**
   * Checks status of the login process
   * @param options
   */
  // checkSession(options: CheckSessionRequestDto): Promise<CheckSessionResponseDto>;
}
