/**
 * (git@|https:\/\/) : for protocol ssh vs https
 * (?<platform>[\w\.]+) : github.com, gitlab.com, etc
 * (?<owner>[\w\/-]+) : owner or the repository, may contains slash
 * (?<repo>[\w\.-]+) : repository name, can not contain slash
 * ((@(?<oid>[0-9a-z]+)){0,1}) : optional oid
 */
const GIT_URI_OBJ = /((git@|https:\/\/)(?<platform>[\w\.]+)(\/|:))(?<owner>[\w\/-]+)\/(?<repo>[\w\.-]+)\.git((\/){0,1})((@(?<oid>[0-9a-z]+)){0,1})/gisu;

type RepoKey = {
  platform: string;
  owner: string;
  repo: string;
  oid: string;
};

/**
 * Parses git uri into dictionary. Both SSH and HTTPS versions are supported
 * SSH version git@github.com:DeepCodeAI/cli.git@1234
 * HTTPS version https://github.com/DeepCodeAI/cli.git@1234
 *
 * In both cases the result should be: \{ platform: gh, owner: DeepCodeAI, repo: cli, oid: 1234 \}
 */
// eslint-disable-next-line consistent-return
export default function parseGitUri(uri: string): RepoKey | undefined {
  const results = uri.matchAll(GIT_URI_OBJ);
  for (const result of results) {
    return result.groups as RepoKey;
  }
}
