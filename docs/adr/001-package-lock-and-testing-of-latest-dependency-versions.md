# package-lock.json and testing of latest dependency versions

- Status: [accepted]
- Date: 2023-07-27

## Context and Problem Statement

The `package.json` only specifies a range for dependency versions.
The actual resolved version depends on the time of resolution and additional constraints imposed by the consumer of the library.
For applications, it is considered best practice to lock the dependencies i.e. to commit a `package-lock.json` file with the exact resolved dependency versions.
This ensures the build/test process is reproducible and consistent dependency versions across environments.
For libraries, the situation is a bit more complex because the library is not in control of the version resolution.

## Considered Options

1. Do not commit a `package-lock.json` and develop/test against latest versions
2. Commit a `package-lock.json` and develop/test against locked versions
3. Commit a `package-lock.json`, develop against locked versions, test against locked and latest versions.

## Decision Outcome

Chosen option: (3)
Implemented in: [34ccb2a](https://github.com/snyk/code-client/commit/34ccb2a0bb68a3fd1e9950bb41924aab07f5649b)

### Pros

- Consistent dev environment
- Deterministic test runs
- Known good set of dependency versions
- Early detection of breaking dependency changes that would affect consumers
- Clear distinction between a dependency breaking and the library breaking

### Cons

- Additional test load in CI
- Possibility for unrelated CI pipeline failures
