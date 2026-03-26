import { useState, useEffect, useRef } from 'react';

export default function Matchmaking({ nakamaClient, timedMode, onMatchFound, onCancel }) {
  const [status, setStatus] = useState('Searching for opponent...');
  const didRun = useRef(false);

  useEffect(() => {
    // Guard against StrictMode double-execution
    if (didRun.current) return;
    didRun.current = true;

    let cancelled = false;
    let currentMatchId = null;

    const findAndJoin = async () => {
      try {
        const socket = nakamaClient.getSocket();
        if (!socket) {
          setStatus('Error: Not connected');
          return;
        }

        // Set up event listeners BEFORE joining so we don't miss any events
        const onMatchData = (event) => {
          if (cancelled) return;
          if (currentMatchId && event.match_id === currentMatchId && event.op_code === 5) {
            // OpCode.START — game is starting
            onMatchFound(currentMatchId);
          }
        };

        const onPresence = (event) => {
          if (cancelled) return;
          if (currentMatchId && event.match_id === currentMatchId && event.joins && event.joins.length > 0) {
            setStatus('Opponent found! Starting game...');
          }
        };

        socket.onmatchdata = onMatchData;
        socket.onmatchpresence = onPresence;

        // Find a match via RPC
        setStatus('Finding a match...');
        const result = await nakamaClient.findMatch(timedMode);
        if (cancelled) return;

        currentMatchId = result.matchId;
        setStatus('Joining match...');

        // Join the match via WebSocket
        const match = await nakamaClient.joinMatch(currentMatchId);
        if (cancelled) return;

        // Check if both players are already present
        const presences = match.presences || [];
        const myUserId = nakamaClient.getSession()?.user_id;
        const otherPlayers = presences.filter(p => p.user_id !== myUserId);

        if (otherPlayers.length >= 1) {
          // Another player is already here — the server will send START
          setStatus('Opponent found! Starting game...');
          // Fallback: if we somehow miss the START event, transition after a short delay
          setTimeout(() => {
            if (!cancelled) {
              onMatchFound(currentMatchId);
            }
          }, 1500);
        } else {
          setStatus('Waiting for opponent to join...');
        }
      } catch (error) {
        console.error('Matchmaking error:', error);
        if (!cancelled) {
          setStatus('Error: ' + (error.message || 'Failed to find match'));
        }
      }
    };

    findAndJoin();

    return () => {
      cancelled = true;
    };
  }, [nakamaClient, timedMode, onMatchFound]);

  return (
    <div className="screen">
      <div className="bg-mesh" />
      <button className="btn btn-secondary btn-sm back-btn" onClick={onCancel} id="cancel-matchmaking-btn">
        ← Back
      </button>
      <div className="matchmaking-card glass-card animate-scale-in">
        <div className="matchmaking-spinner" />
        <div className="matchmaking-text">{status}</div>
        <div className="matchmaking-sub">
          {timedMode ? '⏱️ Timed Mode (30s per turn)' : '⚡ Classic Mode'}
        </div>
      </div>
    </div>
  );
}
