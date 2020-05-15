# Development

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

Add package to your `package.json`:
```json
"dependencies": {
  "@deepcode/tsc": "^1.0.0"
}
```

Now you can use this package as usual:
```javascript
import { ServiceAI } from '@deepcode/tsc';

const AI = new ServiceAI();

async login() {
  const { sessionToken } = await AI.startSession({ 
    baseURL: 'https://www.deepcode.ai',
    source: 'atom' 
  });
  return Promise.resolve(sessionToken);
}
```