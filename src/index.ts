import { ServiceAI } from './modules/ServiceAI';

import { IConfig } from './interfaces/config.interface';
import { IFiles, IFileContent } from './interfaces/files.interface';
import {
  IServiceAI,
  StartSessionResponse,
  CheckSessionResponse,
  GetFiltersResponse,
  CreateBundleResponse,
  CheckBundleResponse,
  ExtendBundleResponse,
  UploadFilesResponse,
  GetAnalysisResponse,
} from './interfaces/service-ai.interface';

import { StartSessionRequestDto } from './dto/start-session.request.dto';
import { StartSessionResponseDto } from './dto/start-session.response.dto';
import { CheckSessionRequestDto } from './dto/check-session.request.dto';
import { CheckSessionResponseDto } from './dto/check-session.response.dto';
import { GetFiltersRequestDto } from './dto/get-filters.request.dto';
import { GetFiltersResponseDto } from './dto/get-filters.response.dto';
import { CreateBundleRequestDto } from './dto/create-bundle.request.dto';
import { CreateBundleResponseDto } from './dto/create-bundle.response.dto';
import { CheckBundleRequestDto } from './dto/check-bundle.request.dto';
import { CheckBundleResponseDto } from './dto/check-bundle.response.dto';
import { ExtendBundleRequestDto } from './dto/extend-bundle.request.dto';
import { ExtendBundleResponseDto } from './dto/extend-bundle.response.dto';
import { UploadFilesRequestDto } from './dto/upload-files.request.dto';
import { UploadFilesResponseDto } from './dto/upload-files.response.dto';
import { GetAnalysisRequestDto } from './dto/get-analysis.request.dto';
import { GetAnalysisResponseDto } from './dto/get-analysis.response.dto';

export {
  ServiceAI,

  IConfig,
  IFiles,
  IFileContent,
  IServiceAI,

  StartSessionResponse,
  CheckSessionResponse,
  GetFiltersResponse,
  CreateBundleResponse,
  CheckBundleResponse,
  ExtendBundleResponse,
  UploadFilesResponse,
  GetAnalysisResponse,

  StartSessionRequestDto,
  StartSessionResponseDto,
  CheckSessionRequestDto,
  CheckSessionResponseDto,
  GetFiltersRequestDto,
  GetFiltersResponseDto,
  CreateBundleRequestDto,
  CreateBundleResponseDto,
  CheckBundleRequestDto,
  CheckBundleResponseDto,
  ExtendBundleRequestDto,
  ExtendBundleResponseDto,
  UploadFilesRequestDto,
  UploadFilesResponseDto,
  GetAnalysisRequestDto,
  GetAnalysisResponseDto,
};
