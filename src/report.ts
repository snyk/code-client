import * as uuid from 'uuid';
import pick from 'lodash.pick';
import { POLLING_INTERVAL } from './constants';
import { emitter } from './emitter';
import {
  AnalysisFailedResponse,
  GetAnalysisErrorCodes,
  UploadReportResponseDto,
  initReport,
  initScmReport,
  AnalysisStatus,
  Result,
  UploadReportOptions,
  getReport,
  getScmReport,
  ScmUploadReportOptions,
  GetReportOptions,
} from './http';
import { ReportResult } from './interfaces/analysis-result.interface';

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

type InitReportGenericType = (
  options: ScmUploadReportOptions | UploadReportOptions,
) => Promise<Result<string, GetAnalysisErrorCodes>>;

type GetReportGenericType = (
  options: GetReportOptions,
) => Promise<Result<UploadReportResponseDto, GetAnalysisErrorCodes>>;

type ReportOptionsGenericType = UploadReportOptions | ScmUploadReportOptions;

async function initAndPollReportGeneric(
  initReportFunc: InitReportGenericType,
  getReportFunc: GetReportGenericType,
  options: ReportOptionsGenericType,
) {
  emitter.analyseProgress({
    status: AnalysisStatus.waiting,
    progress: 0,
  });

  // First init the report
  const initResponse = await initReportFunc(options);

  if (initResponse.type === 'error') {
    return initResponse;
  }
  const pollId = initResponse.value;

  let apiResponse: Result<UploadReportResponseDto, GetAnalysisErrorCodes>;
  let response: UploadReportResponseDto;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    apiResponse = await getReportFunc({
      ...pick(options, ['baseURL', 'sessionToken', 'source', 'requestId', 'org', 'orgId']),
      pollId,
    });

    if (apiResponse.type === 'error') {
      return apiResponse;
    }

    response = apiResponse.value;

    if (
      response.status === AnalysisStatus.waiting ||
      response.status === AnalysisStatus.fetching ||
      response.status === AnalysisStatus.analyzing ||
      response.status === AnalysisStatus.done
    ) {
      // Report progress of fetching
      emitter.analyseProgress(response);
    } else if (response.status === AnalysisStatus.complete) {
      // Return data of analysis
      return apiResponse as Result<ReportResult, GetAnalysisErrorCodes>;
      // deepcode ignore DuplicateIfBody: false positive it seems that interface is not taken into account
    } else if (response.status === AnalysisStatus.failed) {
      // Report failure of analysing
      return apiResponse as Result<AnalysisFailedResponse, GetAnalysisErrorCodes>;
    }

    // eslint-disable-next-line no-await-in-loop
    await sleep(POLLING_INTERVAL);
  }
}

export async function reportBundle(options: UploadReportOptions): Promise<ReportResult> {
  const projectName = options.report?.projectName?.trim();
  if (!projectName || projectName.length === 0) {
    throw new Error('"project-name" must be provided for "report"');
  }
  if (/[^A-Za-z0-9-_/]/g.test(projectName)) {
    throw new Error(`"project-name" must not contain spaces or special characters except [/-_]`);
  }

  // Trigger bundle analysis and emit intermediate progress.
  const response = await initAndPollReportGeneric(initReport, getReport, options);

  if (response.type === 'error') {
    throw response.error;
  } else if (response.value.status === AnalysisStatus.failed) {
    throw new Error('Analysis has failed');
  }

  return response.value;
}

export async function reportScm(options: ScmUploadReportOptions): Promise<ReportResult> {
  const projectId = options.projectId?.trim();
  if (!projectId || projectId.length === 0) {
    throw new Error('"project-id" must be provided for "report"');
  }
  if (!uuid.validate(projectId)) {
    throw new Error('"project-id" must be a valid UUID');
  }

  const commitId = options.commitId?.trim();
  if (!commitId || commitId.length === 0) {
    throw new Error('"commit-id" must be provided for "report"');
  }

  // Trigger SCM project analysis and emit intermediate progress.
  const response = await initAndPollReportGeneric(initScmReport, getScmReport, options);

  if (response.type === 'error') {
    throw response.error;
  } else if (response.value.status === AnalysisStatus.failed) {
    throw new Error('Analysis has failed');
  }

  return response.value;
}
