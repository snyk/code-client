import { IAnalysisResult, ISuggestion, IFileSuggestion } from './interfaces/analysis-result.interface';

interface ISarifSuggestion extends IFileSuggestion {
  id: string;
  level: string;
  text: string;
  file: string;
}
interface ISarifSuggestions {
  [suggestionIndex: number]: ISarifSuggestion;
}
class Sarif {
  private analysisResults: IAnalysisResult;
  private suggestions: ISarifSuggestions;

  constructor(analysisResults: IAnalysisResult) {
    this.analysisResults = analysisResults;
    for (const [file] of Object.entries(analysisResults.files)) {
      for (const [issueId, issue] of <[string, IFileSuggestion][]>Object.entries(analysisResults.files[file])) {
        if (!Object.keys(this.suggestions).includes(issueId)) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          this.suggestions[issueId] = { ...issue[0], file: file.substring(1) };
        }
      }
    }
  }
  public sarifConverter() {
    return { tool: this.getTools(), results: this.getResults() };
  }

  private getTools() {
    const output = { driver: { name: 'DeepCode' } };
    const rules = [];
    for (const [suggestionName, suggestion] of <[string, ISuggestion][]>(
      Object.entries(this.analysisResults.suggestions)
    )) {
      const severityName = suggestion.severity;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const severity = {
        critical: 'error',
        warning: 'warning',
        info: 'note',
      }[severityName];

      const suggestionId = suggestion.id;

      rules.push({
        id: suggestionId,
        name: suggestion.rule,
        shortDescription: {
          text: suggestion.message,
        },
        fullDescription: {
          text: suggestion.message,
        },
        defaultConfiguration: {
          level: severity,
        },
        properties: {
          tags: [suggestionId.split('%2F')[0]],
          precision: 'very-high',
        },
      });

      this.suggestions[suggestionName] = { level: severity, id: suggestionId, text: suggestion.message };
    }
    return { driver: { ...output.driver, rules } };
  }

  private getResults() {
    const output = [];

    for (const [, suggestion] of <[string, ISarifSuggestion][]>Object.entries(this.suggestions)) {
      const result = {
        ruleId: suggestion.id,
        level: suggestion.level,
        message: {
          text: suggestion.text,
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: {
                uri: suggestion.file,
                uriBaseId: '%SRCROOT%',
              },
              region: {
                startLine: suggestion.rows[0],
                endLine: suggestion.rows[1],
                startColumn: suggestion.cols[0],
                endColumn: suggestion.cols[1],
              },
            },
          },
        ],
      };

      const codeThreadFlows = [];
      let i = 0;
      if (suggestion.markers && suggestion.markers.length >= 1) {
        for (const marker of suggestion.markers) {
          for (const position of marker.pos) {
            codeThreadFlows.push({
              location: {
                physicalLocation: {
                  artifactLocation: {
                    uri: suggestion.file,
                    uriBaseId: '%SRCROOT%',
                    index: i,
                  },
                  region: {
                    startLine: position.rows[0],
                    endLine: position.rows[1],
                    startColumn: position.cols[0],
                    endColumn: position.cols[1],
                  },
                },
              },
            });
            i += 1;
          }
        }
      } else {
        codeThreadFlows.push({
          location: {
            physicalLocation: {
              artifactLocation: {
                uri: suggestion.file,
                uriBaseId: '%SRCROOT%',
                index: i,
              },
              region: {
                startLine: suggestion.rows[0],
                endLine: suggestion.rows[1],
                startColumn: suggestion.cols[0],
                endColumn: suggestion.cols[1],
              },
            },
          },
        });
      }
      const newResult = {
        ...result,
        codeFlows: [
          {
            threadFlows: [
              {
                locations: codeThreadFlows,
              },
            ],
          },
        ],
      };
      output.push(newResult);
    }
    return output;
  }
}

export default Sarif;
