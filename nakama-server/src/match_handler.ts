import { GameState, Mark, OpCode, MoveMessage, MatchLabel } from './messages';
import { recordGameResult } from './leaderboard';

const TICK_RATE = 5; // ticks per second
const TURN_DURATION_MS = 30000; // 30 seconds for timed mode

// Winning combinations (indices into the 9-cell board)
const WIN_PATTERNS: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],            // diagonals
];

function checkWinner(board: number[]): Mark {
  for (const pattern of WIN_PATTERNS) {
    const [a, b, c] = pattern;
    if (board[a] !== Mark.EMPTY && board[a] === board[b] && board[b] === board[c]) {
      return board[a] as Mark;
    }
  }
  return Mark.EMPTY;
}

function isBoardFull(board: number[]): boolean {
  return board.every(cell => cell !== Mark.EMPTY);
}

function buildStateMessage(state: GameState): string {
  return JSON.stringify({
    board: state.board,
    marks: state.marks,
    activePlayer: state.activePlayer,
    winner: state.winner,
    gameOver: state.gameOver,
    timedMode: state.timedMode,
    turnDeadline: state.turnDeadline,
    moveCount: state.moveCount,
    usernames: state.usernames,
    playing: state.playing,
    draw: state.draw,
  });
}

/** Reset the game state for a rematch — swap marks so the previous O player goes first. */
function resetForRematch(s: GameState): void {
  s.board = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  s.winner = null;
  s.gameOver = false;
  s.draw = false;
  s.moveCount = 0;
  s.rematchRequestedBy = null;

  // Swap marks so the loser (or O) gets to go first as X
  const uids = Object.keys(s.marks);
  for (const uid of uids) {
    s.marks[uid] = s.marks[uid] === Mark.X ? Mark.O : Mark.X;
  }

  // X goes first
  for (const uid of uids) {
    if (s.marks[uid] === Mark.X) {
      s.activePlayer = uid;
      break;
    }
  }

  s.playing = true;

  if (s.timedMode) {
    s.turnDeadline = Date.now() + s.turnDuration;
  } else {
    s.turnDeadline = 0;
  }
}

export var matchInit: nkruntime.MatchInitFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  params: { [key: string]: string }
): { state: nkruntime.MatchState; tickRate: number; label: string } {
  const timedMode = params['timedMode'] === 'true';

  const state: GameState = {
    board: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    marks: {},
    activePlayer: '',
    winner: null,
    gameOver: false,
    playerCount: 0,
    timedMode: timedMode,
    turnDeadline: 0,
    turnDuration: timedMode ? TURN_DURATION_MS : 0,
    moveCount: 0,
    usernames: {},
    playing: false,
    draw: false,
    label: '',
    rematchRequestedBy: null,
  };

  const labelObj: MatchLabel = { open: 1, timedMode: timedMode };
  state.label = JSON.stringify(labelObj);

  logger.info('Match created. Timed mode: %s', timedMode.toString());

  return {
    state: state as nkruntime.MatchState,
    tickRate: TICK_RATE,
    label: state.label,
  };
};

export var matchJoinAttempt: nkruntime.MatchJoinAttemptFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presence: nkruntime.Presence,
  metadata: { [key: string]: any }
): { state: nkruntime.MatchState; accept: boolean; rejectMessage?: string } {
  const s = state as unknown as GameState;

  if (s.playerCount >= 2) {
    return { state, accept: false, rejectMessage: 'match is full' };
  }

  // Allow joining a game-over match only if it's the same player (rematch scenario)
  if (s.gameOver && !s.marks[presence.userId]) {
    return { state, accept: false, rejectMessage: 'game is already over' };
  }

  logger.info('Player %s attempting to join', presence.userId);
  return { state, accept: true };
};

export var matchJoin: nkruntime.MatchJoinFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[]
): { state: nkruntime.MatchState } | null {
  const s = state as unknown as GameState;

  for (const presence of presences) {
    const userId = presence.userId;

    // Assign mark: first player = X, second = O
    if (Object.keys(s.marks).length === 0) {
      s.marks[userId] = Mark.X;
    } else if (Object.keys(s.marks).length === 1) {
      s.marks[userId] = Mark.O;
    }

    s.usernames[userId] = presence.username;
    s.playerCount++;

    logger.info('Player %s (%s) joined as %s',
      presence.username, userId, s.marks[userId] === Mark.X ? 'X' : 'O');
  }

  // If both players are in, start the game
  if (s.playerCount === 2 && !s.playing && !s.gameOver) {
    // X goes first — find userId with Mark.X
    for (const uid in s.marks) {
      if (s.marks[uid] === Mark.X) {
        s.activePlayer = uid;
        break;
      }
    }

    s.playing = true;

    if (s.timedMode) {
      s.turnDeadline = Date.now() + s.turnDuration;
    }

    // Update label to closed
    const labelObj: MatchLabel = { open: 0, timedMode: s.timedMode };
    s.label = JSON.stringify(labelObj);
    dispatcher.matchLabelUpdate(s.label);

    // Broadcast START + state to both players
    dispatcher.broadcastMessage(OpCode.START, buildStateMessage(s));

    logger.info('Game started!');
  } else {
    // Waiting for opponent — send state to the joining player
    dispatcher.broadcastMessage(OpCode.STATE, buildStateMessage(s));
  }

  return { state: s as nkruntime.MatchState };
};

export var matchLoop: nkruntime.MatchLoopFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  messages: nkruntime.MatchMessage[]
): { state: nkruntime.MatchState } | null {
  const s = state as unknown as GameState;

  // Check for timer expiry in timed mode (only during active play)
  if (s.playing && !s.gameOver && s.timedMode && s.turnDeadline > 0 && Date.now() > s.turnDeadline) {
    const loser = s.activePlayer;
    for (const uid in s.marks) {
      if (uid !== loser) {
        s.winner = uid;
        break;
      }
    }
    s.gameOver = true;

    logger.info('Player %s timed out. Winner: %s', loser, s.winner);

    recordGameResult(nk, logger, s.winner!, loser);

    dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({
      winner: s.winner,
      winnerName: s.usernames[s.winner!],
      reason: 'timeout',
      board: s.board,
      draw: false,
    }));

    return { state: s as nkruntime.MatchState };
  }

  // Process incoming messages
  for (const message of messages) {
    // --- State request ---
    if (message.opCode === OpCode.REQUEST_STATE) {
      dispatcher.broadcastMessage(OpCode.STATE, buildStateMessage(s), [message.sender]);
      continue;
    }

    // --- Rematch request ---
    if (message.opCode === OpCode.REMATCH_REQUEST) {
      if (!s.gameOver) continue; // only valid after game over

      const requesterId = message.sender.userId;
      s.rematchRequestedBy = requesterId;

      logger.info('Player %s requested rematch', requesterId);

      // Notify the OTHER player
      for (const uid in s.marks) {
        if (uid !== requesterId) {
          // Find their presence to send targeted message
          dispatcher.broadcastMessage(OpCode.REMATCH_OFFERED, JSON.stringify({
            requestedBy: requesterId,
            requesterName: s.usernames[requesterId],
          }));
          break;
        }
      }
      continue;
    }

    // --- Rematch response ---
    if (message.opCode === OpCode.REMATCH_RESPONSE) {
      if (!s.gameOver || !s.rematchRequestedBy) continue;

      let response: { accept: boolean };
      try {
        response = JSON.parse(nk.binaryToString(message.data));
      } catch (e) {
        continue;
      }

      if (response.accept) {
        logger.info('Rematch accepted! Resetting game.');
        resetForRematch(s);
        dispatcher.broadcastMessage(OpCode.START, buildStateMessage(s));
      } else {
        logger.info('Rematch declined by %s', message.sender.userId);
        dispatcher.broadcastMessage(OpCode.REMATCH_DECLINED, JSON.stringify({
          declinedBy: message.sender.userId,
          declinedByName: s.usernames[message.sender.userId],
        }));
      }
      continue;
    }

    // --- Moves (only during active play) ---
    if (message.opCode !== OpCode.MOVE) {
      continue;
    }

    if (s.gameOver) continue;

    const senderId = message.sender.userId;

    if (senderId !== s.activePlayer) {
      dispatcher.broadcastMessage(OpCode.MOVE_REJECTED, JSON.stringify({
        reason: 'Not your turn',
      }), [message.sender]);
      continue;
    }

    let move: MoveMessage;
    try {
      move = JSON.parse(nk.binaryToString(message.data));
    } catch (e) {
      dispatcher.broadcastMessage(OpCode.MOVE_REJECTED, JSON.stringify({
        reason: 'Invalid message format',
      }), [message.sender]);
      continue;
    }

    const pos = move.position;

    if (pos < 0 || pos > 8) {
      dispatcher.broadcastMessage(OpCode.MOVE_REJECTED, JSON.stringify({
        reason: 'Position out of range',
      }), [message.sender]);
      continue;
    }

    if (s.board[pos] !== Mark.EMPTY) {
      dispatcher.broadcastMessage(OpCode.MOVE_REJECTED, JSON.stringify({
        reason: 'Cell already occupied',
      }), [message.sender]);
      continue;
    }

    // Apply the move
    s.board[pos] = s.marks[senderId];
    s.moveCount++;

    logger.info('Player %s placed %s at position %d',
      s.usernames[senderId], s.marks[senderId] === Mark.X ? 'X' : 'O', pos);

    // Check for winner
    const winnerMark = checkWinner(s.board);
    if (winnerMark !== Mark.EMPTY) {
      s.winner = senderId;
      s.gameOver = true;

      let loser = '';
      for (const uid in s.marks) {
        if (uid !== senderId) {
          loser = uid;
          break;
        }
      }

      recordGameResult(nk, logger, senderId, loser);

      dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({
        winner: s.winner,
        winnerName: s.usernames[senderId],
        reason: 'win',
        board: s.board,
        draw: false,
      }));

      return { state: s as nkruntime.MatchState };
    }

    // Check for draw
    if (isBoardFull(s.board)) {
      s.gameOver = true;
      s.draw = true;

      const players = Object.keys(s.marks);
      recordGameResult(nk, logger, '', '', players[0], players[1]);

      dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({
        winner: null,
        winnerName: null,
        reason: 'draw',
        board: s.board,
        draw: true,
      }));

      return { state: s as nkruntime.MatchState };
    }

    // Switch active player
    for (const uid in s.marks) {
      if (uid !== senderId) {
        s.activePlayer = uid;
        break;
      }
    }

    // Reset timer for timed mode
    if (s.timedMode) {
      s.turnDeadline = Date.now() + s.turnDuration;
    }

    // Broadcast updated state
    dispatcher.broadcastMessage(OpCode.STATE, buildStateMessage(s));
  }

  return { state: s as nkruntime.MatchState };
};

export var matchLeave: nkruntime.MatchLeaveFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  presences: nkruntime.Presence[]
): { state: nkruntime.MatchState } | null {
  const s = state as unknown as GameState;

  for (const presence of presences) {
    s.playerCount--;
    logger.info('Player %s left the match', presence.userId);

    // If the game was in progress and not already over, the remaining player wins
    if (s.playing && !s.gameOver && s.playerCount > 0) {
      const leaver = presence.userId;
      for (const uid in s.marks) {
        if (uid !== leaver) {
          s.winner = uid;
          break;
        }
      }
      s.gameOver = true;

      recordGameResult(nk, logger, s.winner!, leaver);

      dispatcher.broadcastMessage(OpCode.GAME_OVER, JSON.stringify({
        winner: s.winner,
        winnerName: s.usernames[s.winner!],
        reason: 'forfeit',
        board: s.board,
        draw: false,
      }));
    }

    // If someone leaves during rematch negotiation, notify the other player
    if (s.gameOver && s.playerCount > 0) {
      dispatcher.broadcastMessage(OpCode.REMATCH_DECLINED, JSON.stringify({
        declinedBy: presence.userId,
        declinedByName: s.usernames[presence.userId] || 'Opponent',
        reason: 'left',
      }));
    }
  }

  // If no players left, terminate the match
  if (s.playerCount <= 0) {
    return null;
  }

  return { state: s as nkruntime.MatchState };
};

export var matchTerminate: nkruntime.MatchTerminateFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  graceSeconds: number
): { state: nkruntime.MatchState } | null {
  logger.info('Match terminated');
  return null;
};

export var matchSignal: nkruntime.MatchSignalFunction = function (
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  state: nkruntime.MatchState,
  data: string
): { state: nkruntime.MatchState; data?: string } | null {
  return { state, data: 'signal received' };
};
