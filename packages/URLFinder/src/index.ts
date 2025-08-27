
import { processContactPageFinder } from './adapters/gas/triggers';
import { executeUrlFinderWithUI, executeSelectedMode } from './adapters/gas/ui';
import { test } from './adapters/gas/test';

// GASのグローバル空間に関数を登録

declare const global: any;

global.processContactPageFinder = processContactPageFinder;
global.executeUrlFinderWithUI = executeUrlFinderWithUI;
global.test = test;
