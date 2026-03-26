/**
 * RPC: Create a new match.
 * Payload: { "timedMode": true/false } (optional, defaults to false)
 */
export function rpcCreateMatch(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  let timedMode = false;

  if (payload && payload.length > 0) {
    try {
      const request = JSON.parse(payload);
      timedMode = request.timedMode === true;
    } catch (e) {
      // ignore parse errors, use defaults
    }
  }

  logger.info('rpcCreateMatch called by %s (timedMode: %s)', ctx.userId, timedMode.toString());

  const matchId = nk.matchCreate('tictactoe', { timedMode: timedMode.toString() });
  logger.info('Created new match: %s', matchId);

  return JSON.stringify({ matchId: matchId });
}

/**
 * RPC: Find an open match or create a new one (for random online matchmaking).
 * Lists existing matches without Bleve query, filters by label manually.
 * Payload: { "timedMode": true/false } (optional, defaults to false)
 */
export function rpcFindMatch(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  let timedMode = false;

  if (payload && payload.length > 0) {
    try {
      const request = JSON.parse(payload);
      timedMode = request.timedMode === true;
    } catch (e) {
      // ignore parse errors, use defaults
    }
  }

  logger.info('rpcFindMatch called by %s (timedMode: %s)', ctx.userId, timedMode.toString());

  // List authoritative matches with 0-1 players (room for us to join).
  // No Bleve query — we filter by label manually to avoid query syntax issues.
  let matches: nkruntime.Match[] = [];
  try {
    const result = nk.matchList(10, true, null, 0, 1);
    if (result) {
      matches = result;
    }
  } catch (e) {
    logger.error('Error listing matches: %s', (e as Error).message);
  }

  logger.info('matchList returned %d matches', matches.length);

  // Find a match that is open and has the right mode
  for (const match of matches) {
    try {
      const label = JSON.parse(match.label || '{}');
      if (label.open === 1 && label.timedMode === timedMode) {
        logger.info('Found existing match: %s', match.matchId);
        return JSON.stringify({ matchId: match.matchId });
      }
    } catch (e) {
      // skip matches with bad labels
    }
  }

  // No open match found — create a new one
  const matchId = nk.matchCreate('tictactoe', { timedMode: timedMode.toString() });
  logger.info('Created new match for matchmaking: %s', matchId);

  return JSON.stringify({ matchId: matchId });
}
