import { useEffect, useState } from 'react';
import type { State, Trade } from './types/state';
import './App.css';

function App() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/.netlify/functions/get-state')
      .then((res) => res.json())
      .then((data: State) => setState(data))
      .catch((err) => {
        console.error(err);
        setError('Failed to load state');
      });
  }, []);

  const reloadState = async () => {
    try {
      const fresh = await fetch('/.netlify/functions/get-state').then((r) =>
        r.json()
      );
      setState(fresh);
    } catch (err) {
      console.error(err);
      setError('Failed to reload state');
    }
  };

  const handleTestTrade = async () => {
    const res = await fetch('/.netlify/functions/add-trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromTeamId: 'gtd_pussies',
        toTeamId: 'slimreaper',
        picks: [{ year: 2027, round: 1, originalOwnerId: 'gtd_pussies' }],
        notes: 'Test trade from UI',
      }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? 'Failed to add trade');
      return;
    }

    await reloadState();
  };

  const handleDeleteTrade = async (tradeId: string) => {
    if (!confirm('Are you sure you want to delete this trade?')) {
      return;
    }

    const res = await fetch('/.netlify/functions/delete-trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tradeId }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? 'Failed to delete trade');
      return;
    }

    await reloadState();
  };

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Dynasty Draft Picks</h1>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!state && !error && <p>Loading state…</p>}

      {state && (
        <>
          <section>
            <h2>Trades ({state.trades.length})</h2>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {state.trades.map((t: Trade) => (
                <li
                  key={t.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem',
                    marginBottom: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                  }}
                >
                  <span>
                    {new Date(t.createdAt).toLocaleDateString()} — {t.fromTeamId} ➜ {t.toTeamId}{' '}
                    ({t.picks.length} picks)
                    {t.notes && <span style={{ color: '#666' }}> — {t.notes}</span>}
                  </span>
                  <button
                    onClick={() => handleDeleteTrade(t.id)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <button onClick={handleTestTrade}>Add test trade</button>
        </>
      )}
    </main>
  );
}

export default App;
