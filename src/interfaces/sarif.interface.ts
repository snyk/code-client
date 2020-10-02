export interface ISarifResult {
    readonly $schema: string;
    readonly version: string;
    readonly runs: IRun[];
  }
  
  interface IRun {
    tool: ITool;
    results: IResult[];
  }
  
  interface ITool {
    driver: IDriver
  }
  
  interface IDriver {
    name: string;
    version?: string;
    semanticVersion?: string;
    rules: IRule[];
  }
  
  export interface IRule {
    id: string;
    name?: string;
    shortDescription: IRuleShortDescription;
    fullDescription: IRuleFullDescription;
    defaultConfiguration: IRuleDefaultConfiguration;
    help: IRuleHelp;
    properties: IRuleProperties;
  }
  
  interface IRuleShortDescription{
    text: string;
  }
  
  interface IRuleFullDescription{
    text: string;
  }
  
  interface IRuleDefaultConfiguration{
    level?: severityLevel
  }
  
  enum severityLevel {
    note = 1,
    warning = 2,
    error = 3,
  }
  
  interface IRuleHelp {
    text: string;
    markdown?: string;
  }
  
  interface IRuleProperties {
    tags?: string[];
    precision: string;
  }
  
  interface IResult {
    ruleId?: string;
    ruleIndex?: number;
    rule?: IRule;
    level?: string
    message: IResultMessage;
    locations: IResultLocation[];
    //partialFingerprints should be required 
    partialFingerprints?: IResultPartialFingerPrints;
    codeFlows: IResultCodeFlow[]
    //relatedLocations should be required 
    relatedLocations?: IResultLocation;
    suppressions?: IResultSuppression[];
  }

  interface IResultMessage {
    text: string;
  }
  
  interface IResultLocation {
    id?: string;
    physicalLocation: IPhysicalLocation;
    message?: ILocationMessage;
  }
  
  interface IPhysicalLocation {
    artifactLocation: IArtifactLocation;
    region: IRegion;
  }

  interface IArtifactLocation {
    uri: string;
    uriBadeId?: string
  }

  interface IRegion {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  }

  interface ILocationMessage {
      text?: string
  }

  interface IResultPartialFingerPrints {
    [resultKey: string]: string
  }

  
interface IResultCodeFlow {
    threadFlows: IThreadFlow[]
}

interface IThreadFlow {
    locations: IResultLocation[]
}

interface IResultSuppression {
    state: string
}