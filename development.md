# Package development notes

To use and debug package locally you don't need publish it to NPM registry:
```shell script
$ cd <package-location>
$ npm install && npm run compile && npx yalc publish
```

After that you have to create symlink to your package in your project folder:
```shell script
$ cd <project-location>
$ npx yalc add @deepcode/tsc
```

### Testing on local environment

```shell script
$ cd <package-location>
$ DEEPCODE_URL=http://localhost:8080 DEEPCODE_API_KEY=<your API key on staging> DEEPCODE_AUTH_KEY=<personal access token for your member of DeepCodeAI> npm run test
```

## Publishing

### Before publishing make sure test pass

```shell script
$ cd <package-location>
$ DEEPCODE_API_KEY=<your API key on staging> DEEPCODE_AUTH_KEY=<personal access token for your member of DeepCodeAI> npm run test
```

#### Compile and publish

```shell script
$ cd <package-location>
$ npm run compile
$ npm publish --access public
```
