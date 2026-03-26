import { useState, useEffect, useCallback, useRef } from 'react';
import HomeScreen from './components/HomeScreen';
import GameBoard from './components/GameBoard';
import Leaderboard from './components/Leaderboard';
import nakamaClient from './nakama/nakamaClient';
import './App.css';

const SCREENS = {
  HOME: 'home',
  GAME: 'game',
  LEADERBOARD: 'leaderboard',
};

function App() {
  const [screen, setScreen] = useState(SCREENS.HOME);
  const [matchId, setMatchId] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  const didConnect = useRef(false);
  useEffect(() => {
    if (didConnect.current) return;
    didConnect.current = true;

    const init = async () => {
      try {
        await nakamaClient.authenticate();
        await nakamaClient.connect();
        setConnected(true);
      } catch (e) {
        console.error('Failed to connect to Nakama:', e);
        setError('Failed to connect to game server. Make sure Nakama is running.');
      }
    };
    init();
  }, []);

  const handleCreateGame = useCallback(async (timed) => {
    setCreating(true);
    try {
      const result = await nakamaClient.createMatch(timed);
      setMatchId(result.matchId);
      setScreen(SCREENS.GAME);
    } catch (e) {
      console.error('Failed to create match:', e);
      setError('Failed to create game. Please try again.');
    }
    setCreating(false);
  }, []);

  const handleFindMatch = useCallback(async (timed) => {
    setCreating(true);
    try {
      const result = await nakamaClient.findMatch(timed);
      setMatchId(result.matchId);
      setScreen(SCREENS.GAME);
    } catch (e) {
      console.error('Failed to find match:', e);
      setError('Failed to find match. Please try again.');
    }
    setCreating(false);
  }, []);

  const handleJoinGame = useCallback((id) => {
    setMatchId(id);
    setScreen(SCREENS.GAME);
  }, []);

  const handleGameExit = useCallback(() => {
    setMatchId(null);
    setScreen(SCREENS.HOME);
  }, []);

  const handleLeaderboard = useCallback(() => {
    setScreen(SCREENS.LEADERBOARD);
  }, []);

  const handleBack = useCallback(() => {
    setScreen(SCREENS.HOME);
  }, []);

  if (error) {
    return (
      <div className="screen">
        <div className="bg-mesh" />
        <div className="glass-card animate-fade-in" style={{
          padding: '48px 40px', textAlign: 'center', maxWidth: '400px',
          position: 'relative', zIndex: 1,
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>&#x26A0;&#xFE0F;</div>
          <div style={{
            fontFamily: 'Outfit, sans-serif', fontWeight: 700, fontSize: '1.3rem',
            marginBottom: '12px',
          }}>Connection Error</div>
          <div style={{
            color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px',
            lineHeight: 1.5,
          }}>{error}</div>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!connected || creating) {
    return (
      <div className="screen">
        <div className="bg-mesh" />
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div className="matchmaking-spinner" />
          <div style={{
            fontFamily: 'Outfit, sans-serif', fontWeight: 600,
            color: 'var(--text-secondary)', fontSize: '1.1rem',
          }}>{creating ? 'Finding game...' : 'Connecting to server...'}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {screen === SCREENS.HOME && (
        <HomeScreen
          nakamaClient={nakamaClient}
          onCreateGame={handleCreateGame}
          onFindMatch={handleFindMatch}
          onJoinGame={handleJoinGame}
          onLeaderboard={handleLeaderboard}
        />
      )}
      {screen === SCREENS.GAME && matchId && (
        <GameBoard
          key={matchId}
          nakamaClient={nakamaClient}
          matchId={matchId}
          onExit={handleGameExit}
        />
      )}
      {screen === SCREENS.LEADERBOARD && (
        <Leaderboard
          nakamaClient={nakamaClient}
          onBack={handleBack}
        />
      )}
    </>
  );
}

export default App;
