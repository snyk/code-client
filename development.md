# Package development notes

To use and debug package locally you don't need publish it to NPM registry:
```shell script
$ cd <package-location>
$ npm link
```

After that you have to create symlink to your package in your project folder:
```shell script
$ cd <project-location>
$ npm link @deepcode/tsc
```

## Publishing

### Before publishing make sure test pass

```shell script
$ cd <package-location>
$ DEEPCODE_API_KEY=<your API key on staging> npm run test
```

#### Compile and publish

```shell script
$ cd <package-location>
$ npm run compile
$ npm publish --access public
```
