//This is our own implementation of flat-cache without the use of flattened as we do not need cicular JSON support
//and the executable for flattened was broken
import path from 'path';
import fs from 'fs';

export class Cache {
  public visited = {};
  public persisted = {};
  public pathToFile = '';
  constructor(docId: string, cacheDir?: any) {
    this.pathToFile = cacheDir ? path.resolve(cacheDir, docId) : path.resolve(__dirname, '../.cache/', docId);
    if (fs.existsSync(this.pathToFile)) {
      this.persisted = tryParse(this.pathToFile, {});
    }
  }

  public save(noPrune = false): void {
    !noPrune && this.prune();
    writeJSON(this.pathToFile, this.persisted);
  }

  public getKey(key: string): any {
    this.visited[key] = true;
    return this.persisted[key];
  }

  public setKey(key: string, value: any): void {
    this.visited[key] = true;
    this.persisted[key] = value;
  }
  private prune() {
    const obj = {};

    const keys = Object.keys(this.visited);

    // no keys visited for either get or set value
    if (keys.length === 0) {
      return;
    }

    keys.forEach(key => {
      obj[key] = this.persisted[key];
    });

    this.visited = {};
    this.persisted = obj;
  }
}

function writeJSON(filePath: string, data: any): void {
  fs.mkdirSync(path.dirname(filePath), {
    recursive: true,
  });
  fs.writeFileSync(filePath, JSON.stringify(data));
}
function tryParse(filePath: string, defaultValue: any): JSON {
  let result;
  try {
    result = readJSON(filePath);
  } catch (ex) {
    result = defaultValue;
  }
  return result;
}

export function readJSON(filePath: string): JSON {
  return JSON.parse(
    fs.readFileSync(filePath, {
      encoding: 'utf8',
    }),
  );
}
