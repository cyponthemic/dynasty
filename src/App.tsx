import { useEffect, useState } from 'react';
import type { State, Trade, TeamId, TradePickRef } from './types/state';
import { OwnershipTable } from './components/OwnershipTable';
import { TradeForm } from './components/TradeForm';
import { ToastContainer } from './components/Toast';
import './App.css';

type Toast = {
  id: string;
  message: string;
  type: 'error' | 'success' | 'info';
};

function App() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  useEffect(() => {
    fetch('/.netlify/functions/get-state', {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      },
    })
      .then((res) => res.json())
      .then((data: State) => setState(data))
      .catch((err) => {
        console.error(err);
        const errorMessage = 'Failed to load state';
        setError(errorMessage);
        showToast(errorMessage, 'error');
      });
  }, []);

  const reloadState = async () => {
    try {
      const fresh = await fetch('/.netlify/functions/get-state', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      }).then((r) => r.json());
      setState(fresh);
    } catch (err) {
      console.error(err);
      const errorMessage = 'Failed to reload state';
      setError(errorMessage);
      showToast(errorMessage, 'error');
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
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
      body: JSON.stringify(trade),
    });

    if (!res.ok) {
      const body = await res.json();
      const errorMessage = body.error ?? 'Failed to add trade';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      throw new Error(errorMessage);
    }

    await reloadState();
    setShowTradeForm(false);
    showToast('Trade added successfully!', 'success');
  };

  const handleDeleteTrade = async (tradeId: string) => {
    if (!confirm('Are you sure you want to delete this trade?')) {
      return;
    }

    const res = await fetch('/.netlify/functions/delete-trade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
      body: JSON.stringify({ tradeId }),
    });

    if (!res.ok) {
      const body = await res.json();
      const errorMessage = body.error ?? 'Failed to delete trade';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      return;
    }

    await reloadState();
    showToast('Trade deleted successfully!', 'success');
  };

  return (
    <>
      <style>{`
        @media (min-width: 768px) {
          main {
            padding: 2rem !important;
          }
          
          /* Trade cards: horizontal layout on desktop */
          .trade-card {
            flex-direction: row !important;
            align-items: flex-start !important;
          }
          
          .trade-card .trade-content {
            flex: 1;
          }
          
          .trade-card .trade-button {
            margin-top: 0 !important;
            margin-left: 1rem !important;
            width: auto !important;
            align-self: flex-start !important;
          }
          
          .trade-header {
            flex-wrap: nowrap !important;
          }
          
          .trade-header .separator {
            display: inline !important;
          }
        }
      `}</style>
      <main style={{ 
        padding: '1rem',
        fontFamily: 'system-ui, sans-serif',
        backgroundColor: '#242424',
        color: '#f0f0f0',
        minHeight: '100vh',
        maxWidth: '100vw',
        overflowX: 'hidden',
      }}>
        <ToastContainer toasts={toasts} onClose={removeToast} />
      
      <h1 style={{ color: '#f0f0f0', textAlign: 'center', marginBottom: '0.5rem' }}>Dynasty Draft Picks</h1>

      {error && <p style={{ color: '#ff6b6b' }}>{error}</p>}

      {!state && !error && <p style={{ color: '#f0f0f0' }}>Loading state…</p>}

      {state && (
        <>
          <OwnershipTable state={state} />
          
          <section style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, color: '#f0f0f0' }}>Trades ({state.trades.length})</h2>
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
                onError={(message) => showToast(message, 'error')}
              />
            )}

            <ul style={{ listStyle: 'none', padding: 0 }}>
              {state.trades.map((t: Trade) => {
                const fromTeam = state.teams.find(team => team.id === t.fromTeamId);
                const toTeam = state.teams.find(team => team.id === t.toTeamId);
                const getTeamName = (teamId: TeamId) => {
                  const team = state.teams.find(t => t.id === teamId);
                  return team?.name || teamId;
                };
                
                return (
                  <li
                    key={t.id}
                    className="trade-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '1rem',
                      marginBottom: '1rem',
                      border: '1px solid #444',
                      borderRadius: '8px',
                      backgroundColor: '#2a2a2a',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }}
                  >
                    <div className="trade-content" style={{ flex: 1, width: '100%' }}>
                      <div className="trade-header" style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap',
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        marginBottom: '0.75rem',
                        rowGap: '0.25rem',
                      }}>
                        <span style={{ color: '#aaa', fontSize: '0.85rem', flexShrink: 0 }}>
                          {new Date(t.createdAt).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        <span className="separator" style={{ color: '#666', display: 'none' }}>•</span>
                        <span style={{ fontWeight: 'bold', color: '#f0f0f0', flexShrink: 0 }}>
                          {fromTeam?.name || t.fromTeamId}
                        </span>
                        <span style={{ color: '#aaa', flexShrink: 0 }}>→</span>
                        <span style={{ fontWeight: 'bold', color: '#f0f0f0', flexShrink: 0 }}>
                          {toTeam?.name || t.toTeamId}
                        </span>
                        <span style={{ color: '#aaa', fontSize: '0.85rem', flexShrink: 0 }}>
                          ({t.picks.length} {t.picks.length === 1 ? 'pick' : 'picks'})
                        </span>
                      </div>
                      
                      <div style={{ marginBottom: '0.5rem' }}>
                        <div style={{ 
                          display: 'flex', 
                          flexWrap: 'wrap', 
                          gap: '0.5rem',
                          fontSize: '0.85rem'
                        }}>
                          {t.picks.map((pick, idx) => (
                            <span
                              key={idx}
                              style={{
                                padding: '0.25rem 0.5rem',
                                backgroundColor: '#3a3a3a',
                                borderRadius: '4px',
                                color: '#e0e0e0',
                                border: '1px solid #555',
                              }}
                            >
                              {pick.year} R{pick.round} ({getTeamName(pick.originalOwnerId)})
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      {t.notes && (
                        <div style={{ 
                          marginTop: '0.5rem',
                          padding: '0.5rem',
                          backgroundColor: '#333',
                          borderRadius: '4px',
                          color: '#ccc',
                          fontSize: '0.9rem',
                          fontStyle: 'italic',
                          borderLeft: '3px solid #4a9eff',
                        }}>
                          {t.notes}
                        </div>
                      )}
                    </div>
                    
                    <button
                      className="trade-button"
                      onClick={() => handleDeleteTrade(t.id)}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        marginTop: '0.75rem',
                        alignSelf: 'flex-start',
                        width: '100%',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#c82333';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = '#dc3545';
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
    </>
  );
}

export default App;
