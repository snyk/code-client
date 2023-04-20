import pick from 'lodash.pick';
import { POLLING_INTERVAL } from './constants';
import { emitter } from './emitter';
import {
  AnalysisFailedResponse,
  GetAnalysisErrorCodes,
  UploadReportResponseDto,
  initReport,
  AnalysisStatus,
  Result,
  UploadReportOptions,
  getReport,
} from './http';
import { ReportResult } from './interfaces/analysis-result.interface';

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

async function pollReport(
  options: UploadReportOptions,
): Promise<Result<AnalysisFailedResponse | ReportResult, GetAnalysisErrorCodes>> {
  // Return early if project name is not provided.
  const projectName = options.report?.projectName?.trim();
  const projectNameMaxLength = 64;
  if (!projectName || projectName.length === 0) {
    throw new Error('"project-name" must be provided for "report"');
  }
  if (projectName.length > projectNameMaxLength) {
    throw new Error(`project-name "${projectName}" must not exceed ${projectNameMaxLength} characters`);
  }
  if (/[^A-Za-z0-9-_/]/g.test(projectName)) {
    throw new Error(`project-name "${projectName}" must not contain spaces or special characters except [/-_]`);
  }

  emitter.analyseProgress({
    status: AnalysisStatus.waiting,
    progress: 0,
  });

  // First init the report
  const initResponse = await initReport(options);

  if (initResponse.type === 'error') {
    return initResponse;
  }
  const { reportId } = initResponse.value;

  let apiResponse: Result<UploadReportResponseDto, GetAnalysisErrorCodes>;
  let response: UploadReportResponseDto;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    apiResponse = await getReport({
      ...pick(options, ['baseURL', 'sessionToken', 'source', 'requestId', 'org']),
      reportId,
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
  // Call remote bundle for analysis results and emit intermediate progress
  const response = await pollReport(options);

  if (response.type === 'error') {
    throw response.error;
  } else if (response.value.status === AnalysisStatus.failed) {
    throw new Error('Analysis has failed');
  }

  return response.value;
}
