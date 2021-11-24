declare module 'lang-map';
interface LangMap {
  extensions: (s: string) => string[] | undefined;
  languages: (s: string) => string[] | undefined;
}
declare const langMap: LangMap;
