import { useEffect, useState } from 'react';
import type { State, Trade, TeamId, TradePickRef } from './types/state';
import { OwnershipTable } from './components/OwnershipTable';
import { TradeForm } from './components/TradeForm';
import './App.css';

function App() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTradeForm, setShowTradeForm] = useState(false);

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

  const handleSubmitTrade = async (trade: {
    fromTeamId: TeamId;
    toTeamId: TeamId;
    picks: TradePickRef[];
    notes?: string;
  }) => {
    setError(null);
    const res = await fetch('/.netlify/functions/add-trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trade),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? 'Failed to add trade');
      throw new Error(body.error ?? 'Failed to add trade');
    }

    await reloadState();
    setShowTradeForm(false);
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
          <OwnershipTable state={state} />
          
          <section style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Trades ({state.trades.length})</h2>
              {!showTradeForm && (
                <button
                  onClick={() => setShowTradeForm(true)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                  }}
                >
                  + Create Trade
                </button>
              )}
            </div>

            {showTradeForm && (
              <TradeForm
                state={state}
                onSubmit={handleSubmitTrade}
                onCancel={() => setShowTradeForm(false)}
              />
            )}

            <ul style={{ listStyle: 'none', padding: 0 }}>
              {state.trades.map((t: Trade) => {
                const fromTeam = state.teams.find(team => team.id === t.fromTeamId);
                const toTeam = state.teams.find(team => team.id === t.toTeamId);
                return (
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
                      {new Date(t.createdAt).toLocaleDateString()} — {fromTeam?.name || t.fromTeamId} ➜ {toTeam?.name || t.toTeamId}{' '}
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
                );
              })}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

export default App;
