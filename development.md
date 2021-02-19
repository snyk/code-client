# Package development notes

To use and debug package locally you don't need publish it to NPM registry:

```shell script
$ cd <package-location>
$ npm install && npm run build && npx yalc publish
```

After that you have to create symlink to your package in your project folder:

```shell script
$ cd <project-location>
$ npx yalc add @snyk/code-client
```

## Publishing

### Before publishing make sure test pass

Test variables:

- `SNYK_API_HOST` is the API server host (by default: https://deeproxy.dev.snyk.io)
- `SNYK_AUTH_HOST` is the Snyk authentication server host (by default: https://dev.snyk.io)
- `SNYK_API_KEY` is a sessionToken of a user with access to the Snyk
- `SNYK_API_KEY_NO_ACCESS` is a sessionToken of a user with no access to the snyk organization (even better if on a different platform than GitHub)
- `SNYK_OAUTH_KEY` is a GitHub personal access token of a user with access to the snyk organization

```shell script
$ cd <package-location>
$ SNYK_API_HOST=... SNYK_AUTH_HOST=... SNYK_API_KEY=... SNYK_API_KEY_NO_ACCESS=... SNYK_AUTH_KEY=... npm run test
```

#### Publish

No need to do anything. We have CircleCI CI/CD pipeline with automatic semantic versioning
