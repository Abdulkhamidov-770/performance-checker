/**
 * Rule registry — barcha rule fayllarini yuklab beradi.
 */
import vForNoKey from './vue/v-for-no-key.js';
import noVIfVForSame from './vue/no-v-if-v-for-same-element.js';
import noInlineObjectInTemplate from './vue/no-inline-object-in-template.js';
import preferVShowForToggle from './vue/prefer-v-show-for-toggle.js';
import noComplexExpression from './vue/no-complex-expression-in-template.js';
import noSideEffectInComputed from './vue/no-side-effect-in-computed.js';
import watchDeepImmediate from './vue/watch-deep-immediate.js';
import noSyncRouteImportVue from './vue/no-sync-route-import.js';
import noEmitInLoop from './vue/no-emit-in-loop.js';

import noInlineFunctionInJsx from './react/no-inline-function-in-jsx.js';
import noInlineObjectInJsx from './react/no-inline-object-in-jsx.js';
import useEffectNoDeps from './react/use-effect-no-deps.js';
import noArrayIndexKey from './react/no-array-index-key.js';
import noSyncRouteImportReact from './react/no-sync-route-import.js';
import useStateObjectWithoutSpread from './react/use-state-object-without-spread.js';

import noConsoleInProd from './common/no-console-in-prod.js';
import noFullLibraryImport from './common/no-full-library-import.js';
import awaitInLoop from './common/await-in-loop.js';
import unclearedTimer from './common/uncleared-timer.js';
import unremovedEventListener from './common/unremoved-event-listener.js';
import heavySyncComputation from './common/heavy-sync-computation.js';

export const VUE_RULES = [
  vForNoKey,
  noVIfVForSame,
  noInlineObjectInTemplate,
  preferVShowForToggle,
  noComplexExpression,
  noSideEffectInComputed,
  watchDeepImmediate,
  noSyncRouteImportVue,
  noEmitInLoop,
];

export const REACT_RULES = [
  noInlineFunctionInJsx,
  noInlineObjectInJsx,
  useEffectNoDeps,
  noArrayIndexKey,
  noSyncRouteImportReact,
  useStateObjectWithoutSpread,
];

export const COMMON_RULES = [
  noConsoleInProd,
  noFullLibraryImport,
  awaitInLoop,
  unclearedTimer,
  unremovedEventListener,
  heavySyncComputation,
];

// Vue script ichida ham ishlaydigan common rules (Options API methods)
export const VUE_SCRIPT_RULES = [
  awaitInLoop,
  unclearedTimer,
  heavySyncComputation,
];
