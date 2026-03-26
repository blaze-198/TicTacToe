import { useState, useEffect } from 'react';

export default function HomeScreen({ onCreateGame, onJoinGame, onFindMatch, onLeaderboard, nakamaClient }) {
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [currentName, setCurrentName] = useState('');
  const [joinId, setJoinId] = useState('');

  useEffect(() => {
    const session = nakamaClient.getSession();
    if (session) {
      setCurrentName(session.username || '');
      setUsername(session.username || '');
    }
  }, [nakamaClient]);

  const handleSetUsername = async () => {
    if (!username.trim() || username.trim().length < 3) return;
    setSaving(true);
    try {
      await nakamaClient.updateUsername(username.trim());
      setCurrentName(username.trim());
    } catch (e) {
      console.error('Failed to update username:', e);
    }
    setSaving(false);
  };

  const handleJoin = () => {
    const id = joinId.trim();
    if (!id) return;
    onJoinGame(id);
  };

  return (
    <div className="screen">
      <div className="bg-mesh" />
      <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="animate-fade-in">
          <div className="home-logo">Tic Tac Toe</div>
          <div className="home-subtitle">Multiplayer &bull; Real-time</div>
        </div>

        <div className="animate-slide-up" style={{ animationDelay: '0.1s', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="username-input-group">
            <input
              id="username-input"
              className="username-input"
              type="text"
              placeholder="Choose a username..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSetUsername()}
              maxLength={20}
            />
            <button
              id="save-username-btn"
              className="btn btn-secondary btn-sm"
              onClick={handleSetUsername}
              disabled={saving || !username.trim() || username.trim().length < 3}
            >
              {saving ? '...' : 'Set'}
            </button>
          </div>
          {currentName && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px', marginTop: '-16px' }}>
              Playing as <span style={{ color: 'var(--accent-indigo)', fontWeight: 600 }}>{currentName}</span>
            </div>
          )}
        </div>

        <div className="home-actions animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <button id="find-match-btn" className="btn btn-primary btn-lg" onClick={() => onFindMatch(false)}>
            Play Online
          </button>

          <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
            <button id="create-classic-btn" className="btn btn-secondary" onClick={() => onCreateGame(false)} style={{ flex: 1 }}>
              Create Game
            </button>
            <button id="create-timed-btn" className="btn btn-secondary" onClick={() => onCreateGame(true)} style={{ flex: 1 }}>
              Timed (30s)
            </button>
          </div>

          <div className="username-input-group" style={{ marginBottom: 0 }}>
            <input
              id="join-id-input"
              className="username-input"
              type="text"
              placeholder="Enter Game ID..."
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            <button
              id="join-game-btn"
              className="btn btn-secondary btn-sm"
              onClick={handleJoin}
              disabled={!joinId.trim()}
            >
              Join
            </button>
          </div>

          <button id="leaderboard-btn" className="btn btn-secondary" onClick={onLeaderboard}>
            Leaderboard
          </button>
        </div>
      </div>
    </div>
  );
}
