/** Op-code constants for client↔server match messages */
export enum OpCode {
  /** Client → Server: Player makes a move. Data: { position: number } */
  MOVE = 1,
  /** Server → Client: Full game state update. */
  STATE = 2,
  /** Server → Client: Game over notification. */
  GAME_OVER = 3,
  /** Server → Client: Move was rejected. Data: { reason: string } */
  MOVE_REJECTED = 4,
  /** Server → Client: Game has started, both players present. */
  START = 5,
  /** Client → Server: Request current game state (used after reconnect/late mount). */
  REQUEST_STATE = 6,
  /** Client → Server: Player requests a rematch. */
  REMATCH_REQUEST = 7,
  /** Client → Server: Player responds to rematch offer. Data: { accept: boolean } */
  REMATCH_RESPONSE = 8,
  /** Server → Client: Opponent is offering a rematch. */
  REMATCH_OFFERED = 9,
  /** Server → Client: Rematch was declined — both players should exit. */
  REMATCH_DECLINED = 10,
}

export enum Mark {
  EMPTY = 0,
  X = 1,
  O = 2,
}

export interface GameState {
  /** 9-element board: 0=empty, 1=X, 2=O */
  board: number[];
  /** Map of userId → Mark */
  marks: { [userId: string]: Mark };
  /** userId of whose turn it is */
  activePlayer: string;
  /** userId of winner, or null */
  winner: string | null;
  /** true when game is finished */
  gameOver: boolean;
  /** number of players who have joined */
  playerCount: number;
  /** true if timed mode */
  timedMode: boolean;
  /** epoch ms deadline for current turn (0 if untimed) */
  turnDeadline: number;
  /** turn duration in ms */
  turnDuration: number;
  /** total moves made */
  moveCount: number;
  /** usernames keyed by userId */
  usernames: { [userId: string]: string };
  /** whether game has started (both players joined) */
  playing: boolean;
  /** draw flag */
  draw: boolean;
  /** match label for discovery */
  label: string;
  /** userId of the player who requested a rematch, or null */
  rematchRequestedBy: string | null;
}

export interface MoveMessage {
  position: number;
}

export interface MatchLabel {
  open: number;        // 1 = open for joining, 0 = full/in-progress
  timedMode: boolean;
}
