import { FILE_CURRENT_STATUS } from "../constants/files";
import {
  IBundles,
  IHashesBundles,
  IRemoteBundlesCollection,
} from '../interfaces/bundle.interface';

export const checkIfBundleIsEmpty = (
  bundlesBatch:
    | IHashesBundles
    | IRemoteBundlesCollection,
  bundlePath?: string
): boolean =>
  !Object.keys(bundlePath ? bundlesBatch[bundlePath] || {} : bundlesBatch).length;

export const extendLocalHashBundle = (
  updatedFiles: Array<{
    [key: string]: string;
  }>,
  currentHashBundle: IBundles
): IBundles => {
  const modifiedHashBundle: IBundles = {
    ...currentHashBundle
  };
  for (const updatedFile of updatedFiles) {
    if (
      updatedFile.status === FILE_CURRENT_STATUS.deleted &&
      modifiedHashBundle[updatedFile.filePath]
    ) {
      delete modifiedHashBundle[updatedFile.filePath];
    }
    if (
      updatedFile.status === FILE_CURRENT_STATUS.modified ||
      updatedFile.status === FILE_CURRENT_STATUS.created
    ) {
      modifiedHashBundle[updatedFile.filePath] = updatedFile.fileHash;
    }
  }
  return modifiedHashBundle;
};
