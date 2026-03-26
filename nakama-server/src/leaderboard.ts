const WINS_LEADERBOARD = 'wins_leaderboard';
const STATS_COLLECTION = 'player_stats';
const STATS_KEY = 'stats';

export function initLeaderboards(nk: nkruntime.Nakama, logger: nkruntime.Logger): void {
  // Create the wins leaderboard — higher score = more wins
  // Operator BEST = keep highest score; order DESC = descending
  nk.leaderboardCreate(WINS_LEADERBOARD, true, nkruntime.SortOrder.DESCENDING,
    nkruntime.Operator.BEST, '');
  logger.info('Leaderboard "%s" created/verified', WINS_LEADERBOARD);
}

interface PlayerStats {
  wins: number;
  losses: number;
  draws: number;
  currentStreak: number;
  bestStreak: number;
}

function getPlayerStats(nk: nkruntime.Nakama, userId: string): PlayerStats {
  const objs = nk.storageRead([{
    collection: STATS_COLLECTION,
    key: STATS_KEY,
    userId: userId,
  }]);

  if (objs.length > 0 && objs[0].value) {
    return objs[0].value as PlayerStats;
  }

  return { wins: 0, losses: 0, draws: 0, currentStreak: 0, bestStreak: 0 };
}

function savePlayerStats(nk: nkruntime.Nakama, userId: string, stats: PlayerStats): void {
  nk.storageWrite([{
    collection: STATS_COLLECTION,
    key: STATS_KEY,
    userId: userId,
    value: stats as { [key: string]: any },
    permissionRead: 2, // public read
    permissionWrite: 0, // server only write
  }]);
}

/**
 * Record game result. For a draw, pass empty strings for winner/loser
 * and provide both player IDs.
 */
export function recordGameResult(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  winnerId: string,
  loserId: string,
  drawPlayer1?: string,
  drawPlayer2?: string,
): void {
  if (drawPlayer1 && drawPlayer2) {
    // Draw
    const stats1 = getPlayerStats(nk, drawPlayer1);
    stats1.draws++;
    stats1.currentStreak = 0;
    savePlayerStats(nk, drawPlayer1, stats1);

    const stats2 = getPlayerStats(nk, drawPlayer2);
    stats2.draws++;
    stats2.currentStreak = 0;
    savePlayerStats(nk, drawPlayer2, stats2);

    logger.info('Draw recorded for %s and %s', drawPlayer1, drawPlayer2);
    return;
  }

  if (!winnerId || !loserId) return;

  // Update winner stats
  const winnerStats = getPlayerStats(nk, winnerId);
  winnerStats.wins++;
  winnerStats.currentStreak++;
  if (winnerStats.currentStreak > winnerStats.bestStreak) {
    winnerStats.bestStreak = winnerStats.currentStreak;
  }
  savePlayerStats(nk, winnerId, winnerStats);

  // Update leaderboard
  nk.leaderboardRecordWrite(WINS_LEADERBOARD, winnerId, '', winnerStats.wins, winnerStats.wins);

  // Update loser stats
  const loserStats = getPlayerStats(nk, loserId);
  loserStats.losses++;
  loserStats.currentStreak = 0;
  savePlayerStats(nk, loserId, loserStats);

  // Ensure loser also has a leaderboard entry
  nk.leaderboardRecordWrite(WINS_LEADERBOARD, loserId, '', loserStats.wins, loserStats.wins);

  logger.info('Win recorded: %s | Loss recorded: %s', winnerId, loserId);
}

/**
 * RPC handler: get leaderboard data with player stats
 */
export function rpcGetLeaderboard(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  const limit = 20;
  const records = nk.leaderboardRecordsList(WINS_LEADERBOARD, [], limit, undefined, 0);

  const result: any[] = [];

  if (records && records.records) {
    for (const record of records.records) {
      // Get full stats for this player
      const stats = getPlayerStats(nk, record.ownerId);

      result.push({
        rank: record.rank,
        userId: record.ownerId,
        username: record.username || 'Anonymous',
        wins: stats.wins,
        losses: stats.losses,
        draws: stats.draws,
        currentStreak: stats.currentStreak,
        bestStreak: stats.bestStreak,
      });
    }
  }

  return JSON.stringify({ records: result });
}
