/*
   Copyright 2019 DeepCode AG

   Author: Benjamin Mularczyk
*/

import ignore, { Ignore } from 'ignore';

import * as nodePath from 'path';

export class ExclusionRule {
  ig_: Ignore = ignore();
  prefix_ = '';
  set_ = false;

  addExclusions(exclusions: Array<string>, prefix: string): void {
    if (this.set_) return;
    this.ig_.add(exclusions);
    this.prefix_ = prefix;
    this.set_ = true;
  }

  excludes(path: string): boolean {
    return this.ig_.ignores(nodePath.relative(this.prefix_, path));
  }
}

// A filter that allows to filter paths based on .gitignore spec.
export class ExclusionFilter {
  exclusions_: Array<ExclusionRule> = [];

  addExclusionRule(exclusion: ExclusionRule): void {
    this.exclusions_.push(exclusion);
  }

  excludes(path: string): boolean {
    for (const exclusion of this.exclusions_) {
      if (exclusion.excludes(path)) {
        return true;
      }
    }
    return false;
  }

  copy(): ExclusionFilter {
    const newFilter = new ExclusionFilter();
    newFilter.exclusions_ = [...this.exclusions_];
    return newFilter;
  }
}
