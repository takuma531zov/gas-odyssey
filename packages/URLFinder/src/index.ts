
import { processContactPageFinder } from './gas/triggers';
import { executeUrlFinderWithUI, executeSelectedMode } from './gas/ui';
import { test } from './gas/test';

// GASのグローバル空間に関数を登録

declare const global: any;

global.processContactPageFinder = processContactPageFinder;
global.executeUrlFinderWithUI = executeUrlFinderWithUI;
global.executeSelectedMode = executeSelectedMode;
global.test = test;
