
import { processContactPageFinder } from './adapters/gas/triggers';
import { executeUrlFinderWithUI } from './adapters/gas/ui';
import { test } from './adapters/gas/test';

// GASのグローバル空間に関数を登録

declare const global: {
  processContactPageFinder: typeof processContactPageFinder;
  executeUrlFinderWithUI: typeof executeUrlFinderWithUI;
  test: typeof test;
};

global.processContactPageFinder = processContactPageFinder;
global.executeUrlFinderWithUI = executeUrlFinderWithUI;
global.test = test;
