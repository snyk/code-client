export interface IBundles {
  [key: string]: string;
}

export interface IHashesBundles {
  [key: string]: IBundles;
}

export interface IRemoteBundle {
  bundleId?: string;
  missingFiles?: Array<string>;
  uploadURL?: string;
}

export interface IRemoteBundlesCollection {
  [key: string]: IRemoteBundle;
}
