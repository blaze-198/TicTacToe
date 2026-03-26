import {
  matchInit,
  matchJoinAttempt,
  matchJoin,
  matchLoop,
  matchLeave,
  matchTerminate,
  matchSignal,
} from './match_handler';
import { rpcCreateMatch, rpcFindMatch } from './rpc';
import { initLeaderboards, rpcGetLeaderboard } from './leaderboard';

/**
 * Nakama server runtime entry point.
 * Called once when the server loads this module.
 * Must be a function named `InitModule` in the global scope.
 */
var InitModule: nkruntime.InitModule = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
): void {
  logger.info('=== Tic-Tac-Toe Server Module Loading ===');

  // Register the authoritative match handler
  initializer.registerMatch('tictactoe', {
    matchInit: matchInit,
    matchJoinAttempt: matchJoinAttempt,
    matchJoin: matchJoin,
    matchLoop: matchLoop,
    matchLeave: matchLeave,
    matchTerminate: matchTerminate,
    matchSignal: matchSignal,
  });

  // Register RPC functions
  initializer.registerRpc('create_match', rpcCreateMatch);
  initializer.registerRpc('find_match', rpcFindMatch);
  initializer.registerRpc('get_leaderboard', rpcGetLeaderboard);

  // Initialize leaderboards
  initLeaderboards(nk, logger);

  logger.info('=== Tic-Tac-Toe Server Module Loaded Successfully ===');
};

