import { useState, useEffect } from 'react';

export default function Leaderboard({ nakamaClient, onBack }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const data = await nakamaClient.getLeaderboard();
        setRecords(data.records || []);
      } catch (e) {
        console.error('Failed to fetch leaderboard:', e);
        setError('Failed to load leaderboard');
      }
      setLoading(false);
    };

    fetchLeaderboard();
  }, [nakamaClient]);

  const getRankBadgeClass = (rank) => {
    if (rank === 1) return 'rank-badge gold';
    if (rank === 2) return 'rank-badge silver';
    if (rank === 3) return 'rank-badge bronze';
    return 'rank-badge';
  };

  const getRankEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
  };

  const getItemClass = (rank) => {
    if (rank === 1) return 'leaderboard-item top-1';
    if (rank === 2) return 'leaderboard-item top-2';
    if (rank === 3) return 'leaderboard-item top-3';
    return 'leaderboard-item';
  };

  return (
    <div className="screen">
      <div className="bg-mesh" />
      <button className="btn btn-secondary btn-sm back-btn" onClick={onBack} id="leaderboard-back-btn">
        ← Back
      </button>
      <div className="leaderboard-container animate-fade-in" style={{ position: 'relative', zIndex: 1 }}>
        <div className="leaderboard-header">
          <div className="leaderboard-title">🏆 Leaderboard</div>
          <div className="leaderboard-subtitle">Top players ranked by wins</div>
        </div>

        {loading && (
          <div className="leaderboard-empty">
            <div className="matchmaking-spinner" style={{ margin: '0 auto' }} />
            <div style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Loading...</div>
          </div>
        )}

        {error && (
          <div className="leaderboard-empty">
            <div className="leaderboard-empty-icon">⚠️</div>
            <div>{error}</div>
          </div>
        )}

        {!loading && !error && records.length === 0 && (
          <div className="leaderboard-empty">
            <div className="leaderboard-empty-icon">🎮</div>
            <div>No games played yet</div>
            <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>Be the first to play!</div>
          </div>
        )}

        {!loading && !error && records.length > 0 && (
          <div className="leaderboard-list">
            {records.map((record, index) => (
              <div
                key={record.userId}
                className={getItemClass(record.rank)}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className={getRankBadgeClass(record.rank)}>
                  {getRankEmoji(record.rank)}
                </div>
                <div className="player-info">
                  <div className="player-username">{record.username}</div>
                  <div className="player-record">
                    {record.wins}W - {record.losses}L - {record.draws}D
                    {record.bestStreak > 0 && ` • Best streak: ${record.bestStreak}`}
                  </div>
                </div>
                <div className="player-stats">
                  <div className="stat-value">{record.wins}</div>
                  <div className="stat-label">wins</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center' }}>
          <button className="btn btn-secondary" onClick={onBack} id="leaderboard-home-btn">
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
