import { useState, useEffect, useCallback, useRef } from 'react';

const OP_MOVE = 1;
const OP_STATE = 2;
const OP_GAME_OVER = 3;
const OP_MOVE_REJECTED = 4;
const OP_START = 5;
const OP_REQUEST_STATE = 6;
const OP_REMATCH_REQUEST = 7;
const OP_REMATCH_RESPONSE = 8;
const OP_REMATCH_OFFERED = 9;
const OP_REMATCH_DECLINED = 10;

export default function GameBoard({ nakamaClient, matchId, onExit }) {
  const [board, setBoard] = useState([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [myMark, setMyMark] = useState(null);
  const [activePlayer, setActivePlayer] = useState('');
  const [usernames, setUsernames] = useState({});
  const [marks, setMarks] = useState({});
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [timedMode, setTimedMode] = useState(false);
  const [turnDeadline, setTurnDeadline] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [rejected, setRejected] = useState('');
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Rematch states
  const [rematchSent, setRematchSent] = useState(false);
  const [rematchOffered, setRematchOffered] = useState(false);
  const [rematchDeniedMsg, setRematchDeniedMsg] = useState(null);

  const myUserId = nakamaClient.getSession()?.user_id;
  const timerRef = useRef(null);
  const didJoin = useRef(false);

  const processState = useCallback((data) => {
    setBoard(data.board);
    setActivePlayer(data.activePlayer);
    setUsernames(data.usernames || {});
    setMarks(data.marks || {});
    setTimedMode(data.timedMode || false);
    setTurnDeadline(data.turnDeadline || 0);
    setPlaying(data.playing || false);

    if (data.marks && myUserId && data.marks[myUserId]) {
      setMyMark(data.marks[myUserId]);
    }
  }, [myUserId]);

  useEffect(() => {
    if (didJoin.current) return;
    didJoin.current = true;

    const socket = nakamaClient.getSocket();
    if (!socket) return;

    const onMatchData = (event) => {
      if (event.match_id !== matchId) return;

      let data;
      try {
        const decoder = new TextDecoder();
        data = JSON.parse(decoder.decode(event.data));
      } catch (e) {
        console.error('Failed to parse match data:', e);
        return;
      }

      switch (event.op_code) {
        case OP_START:
          // Reset rematch state for new round
          setGameOver(false);
          setGameResult(null);
          setRematchSent(false);
          setRematchOffered(false);
          setRematchDeniedMsg(null);
          processState(data);
          break;
        case OP_STATE:
          processState(data);
          break;
        case OP_GAME_OVER:
          setBoard(data.board);
          setGameOver(true);
          setGameResult(data);
          break;
        case OP_MOVE_REJECTED:
          setRejected(data.reason);
          setTimeout(() => setRejected(''), 2000);
          break;
        case OP_REMATCH_OFFERED:
          setRematchOffered(true);
          break;
        case OP_REMATCH_DECLINED:
          setRematchDeniedMsg(
            data.reason === 'left'
              ? 'Opponent left the match'
              : `${data.declinedByName || 'Opponent'} declined the rematch`
          );
          // Auto-exit after showing the message
          setTimeout(() => onExit(), 2500);
          break;
        default:
          break;
      }
    };

    socket.onmatchdata = onMatchData;

    const joinMatch = async () => {
      try {
        await nakamaClient.joinMatch(matchId);
        setJoined(true);
        socket.sendMatchState(matchId, OP_REQUEST_STATE, '{}');
      } catch (error) {
        console.error('Failed to join match:', error);
        setJoinError(error.message || 'Failed to join match. Check the Game ID.');
      }
    };

    joinMatch();
  }, [nakamaClient, matchId, processState, onExit]);

  // Timer countdown
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (timedMode && turnDeadline > 0 && playing && !gameOver) {
      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, turnDeadline - Date.now());
        setTimeLeft(Math.ceil(remaining / 1000));
        if (remaining <= 0) clearInterval(timerRef.current);
      }, 100);
    } else {
      setTimeLeft(null);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timedMode, turnDeadline, playing, gameOver]);

  const handleCellClick = (index) => {
    if (gameOver || !playing || board[index] !== 0 || activePlayer !== myUserId) return;
    nakamaClient.sendMove(matchId, index);
  };

  const handleLeaveMatch = () => {
    try { nakamaClient.getSocket()?.leaveMatch(matchId); } catch(e) { /* ignore */ }
    onExit();
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(matchId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRematchRequest = () => {
    setRematchSent(true);
    nakamaClient.getSocket()?.sendMatchState(matchId, OP_REMATCH_REQUEST, '{}');
  };

  const handleRematchAccept = () => {
    nakamaClient.getSocket()?.sendMatchState(matchId, OP_REMATCH_RESPONSE, JSON.stringify({ accept: true }));
    setRematchOffered(false);
  };

  const handleRematchDecline = () => {
    nakamaClient.getSocket()?.sendMatchState(matchId, OP_REMATCH_RESPONSE, JSON.stringify({ accept: false }));
    setRematchOffered(false);
  };

  const isMyTurn = activePlayer === myUserId && playing && !gameOver;
  const myUsername = myUserId ? (usernames[myUserId] || 'You') : 'You';

  let opponentUsername = 'Opponent';
  let opponentMark = null;
  for (const uid in marks) {
    if (uid !== myUserId) {
      opponentUsername = usernames[uid] || 'Opponent';
      opponentMark = marks[uid];
    }
  }

  const getCellContent = (value) => {
    if (value === 1) return <span className="cell-x">X</span>;
    if (value === 2) return <span className="cell-o">O</span>;
    return null;
  };

  const getTimerClass = () => {
    if (timeLeft === null) return 'timer-display';
    if (timeLeft <= 5) return 'timer-display timer-critical';
    if (timeLeft <= 10) return 'timer-display timer-warning';
    return 'timer-display';
  };

  const getResultInfo = () => {
    if (!gameResult) return {};
    if (gameResult.draw) {
      return { emoji: '🤝', title: "It's a Draw!", titleClass: 'draw-title', reason: 'Both players played perfectly!' };
    }
    const isWinner = gameResult.winner === myUserId;
    if (isWinner) {
      const reason = gameResult.reason === 'forfeit' ? 'Opponent disconnected'
        : gameResult.reason === 'timeout' ? 'Opponent ran out of time'
        : 'You got three in a row!';
      return { emoji: '🎉', title: 'You Win!', titleClass: 'win', reason };
    } else {
      const reason = gameResult.reason === 'forfeit' ? 'You disconnected'
        : gameResult.reason === 'timeout' ? 'You ran out of time'
        : `${gameResult.winnerName || 'Opponent'} got three in a row`;
      return { emoji: '😔', title: 'You Lose', titleClass: 'lose', reason };
    }
  };

  // --- Error state ---
  if (joinError) {
    return (
      <div className="screen">
        <div className="bg-mesh" />
        <div className="glass-card animate-fade-in" style={{ padding: '48px 40px', textAlign: 'center', maxWidth: '400px', position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>&#x26A0;&#xFE0F;</div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '1.3rem', marginBottom: '12px' }}>Join Failed</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: 1.5 }}>{joinError}</div>
          <button className="btn btn-primary" onClick={onExit}>Back to Home</button>
        </div>
      </div>
    );
  }

  // --- Waiting for opponent ---
  if (joined && !playing && !gameOver) {
    return (
      <div className="screen">
        <div className="bg-mesh" />
        <button className="btn btn-secondary btn-sm back-btn" onClick={handleLeaveMatch}>&#8592; Back</button>
        <div className="matchmaking-card glass-card animate-scale-in">
          <div className="matchmaking-spinner" />
          <div className="matchmaking-text">Waiting for opponent...</div>
          <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Game ID</div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--accent-cyan)', wordBreak: 'break-all', marginBottom: '12px' }}>{matchId}</div>
            <button className="btn btn-secondary btn-sm" onClick={handleCopyId} style={{ width: '100%' }}>{copied ? 'Copied!' : 'Copy Game ID'}</button>
          </div>
          <div className="matchmaking-sub" style={{ marginTop: '16px' }}>Share the Game ID with your opponent</div>
        </div>
      </div>
    );
  }

  // --- Joining state ---
  if (!joined) {
    return (
      <div className="screen">
        <div className="bg-mesh" />
        <div className="matchmaking-card glass-card animate-scale-in">
          <div className="matchmaking-spinner" />
          <div className="matchmaking-text">Joining match...</div>
        </div>
      </div>
    );
  }

  // --- Game in progress ---
  return (
    <div className="screen">
      <div className="bg-mesh" />
      <div className="game-container animate-fade-in" style={{ position: 'relative', zIndex: 1 }}>
        <div className="game-header">
          <div className={`player-card ${isMyTurn ? 'active' : ''}`}>
            <div className="player-name">{myUsername}</div>
            <div className="player-mark">
              <span className={myMark === 1 ? 'mark-x' : 'mark-o'}>{myMark === 1 ? 'X' : myMark === 2 ? 'O' : '?'}</span>
            </div>
          </div>
          <div className="vs-divider">VS</div>
          <div className={`player-card ${!isMyTurn && playing ? 'active' : ''}`}>
            <div className="player-name">{opponentUsername}</div>
            <div className="player-mark">
              <span className={opponentMark === 1 ? 'mark-x' : 'mark-o'}>{opponentMark === 1 ? 'X' : opponentMark === 2 ? 'O' : '?'}</span>
            </div>
          </div>
        </div>

        {timedMode && timeLeft !== null && playing && !gameOver && (
          <div className="timer-bar">
            <div className={getTimerClass()}>
              <span className="timer-icon">&#x23F1;&#xFE0F;</span>
              <span className="timer-text">{timeLeft}s</span>
            </div>
          </div>
        )}

        <div className="board-wrapper">
          <div className="board" id="game-board">
            {board.map((cell, index) => (
              <div key={index} className={`cell ${cell !== 0 ? 'cell-filled' : ''}`} onClick={() => handleCellClick(index)} id={`cell-${index}`}>
                {getCellContent(cell)}
              </div>
            ))}
          </div>
        </div>

        {!gameOver && (
          <div className={`game-status ${isMyTurn ? 'your-turn' : ''}`}>
            {isMyTurn ? 'Your turn!' : `Waiting for ${opponentUsername}...`}
          </div>
        )}

        {rejected && (
          <div style={{ textAlign: 'center', color: 'var(--accent-rose)', marginTop: '8px', fontSize: '0.85rem' }}>{rejected}</div>
        )}

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleLeaveMatch} id="leave-game-btn">Leave Game</button>
        </div>
      </div>

      {/* --- Game Over Overlay --- */}
      {gameOver && gameResult && !rematchDeniedMsg && (() => {
        const info = getResultInfo();
        return (
          <div className="game-over-overlay">
            <div className="game-over-card glass-card">
              <div className="game-over-emoji">{info.emoji}</div>
              <div className={`game-over-title ${info.titleClass}`}>{info.title}</div>
              <div className="game-over-reason">{info.reason}</div>

              {/* Rematch offer received */}
              {rematchOffered && !rematchSent && (
                <div style={{ marginTop: '20px', marginBottom: '12px' }}>
                  <div style={{ color: 'var(--accent-cyan)', fontFamily: 'Outfit, sans-serif', fontWeight: 600, marginBottom: '12px' }}>
                    {opponentUsername} wants a rematch!
                  </div>
                  <div className="game-over-actions">
                    <button className="btn btn-success" onClick={handleRematchAccept}>Accept Rematch</button>
                    <button className="btn btn-danger" onClick={handleRematchDecline}>Decline</button>
                  </div>
                </div>
              )}

              {/* Default actions (no rematch offer received) */}
              {!rematchOffered && (
                <div className="game-over-actions">
                  {rematchSent ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '14px 0' }}>
                      <div className="matchmaking-spinner" style={{ width: '24px', height: '24px', margin: 0, borderWidth: '2px' }} />
                      <span style={{ color: 'var(--text-secondary)', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>
                        Waiting for opponent...
                      </span>
                    </div>
                  ) : (
                    <button className="btn btn-primary" onClick={handleRematchRequest}>Rematch</button>
                  )}
                  <button className="btn btn-secondary" onClick={handleLeaveMatch}>Back to Home</button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* --- Rematch Denied Overlay --- */}
      {rematchDeniedMsg && (
        <div className="game-over-overlay">
          <div className="game-over-card glass-card">
            <div className="game-over-emoji">&#x1F44B;</div>
            <div className="game-over-title" style={{ color: 'var(--text-primary)' }}>{rematchDeniedMsg}</div>
            <div className="game-over-reason">Returning to home...</div>
          </div>
        </div>
      )}
    </div>
  );
}
