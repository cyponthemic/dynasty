import type { State, TeamId } from '../types/state';
import { isPickLockedByStepienRule } from '../lib/tradeValidation';

type OwnershipTableProps = {
  state: State;
};

// Helper function to rebuild ownership by replaying trades
function rebuildOwnership(state: State): Map<string, TeamId> {
  // Start with basePicks ownership
  const ownership = new Map<string, TeamId>();
  
  for (const pick of state.basePicks) {
    const key = `${pick.year}-${pick.round}-${pick.originalOwnerId}`;
    ownership.set(key, pick.currentOwnerId);
  }

  // Replay trades chronologically
  const sortedTrades = [...state.trades].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const trade of sortedTrades) {
    for (const pickRef of trade.picks) {
      const key = `${pickRef.year}-${pickRef.round}-${pickRef.originalOwnerId}`;
      // Update ownership: pick moves from fromTeamId to toTeamId
      if (ownership.has(key)) {
        const currentOwner = ownership.get(key);
        // Only transfer if the current owner matches the fromTeamId
        if (currentOwner === trade.fromTeamId) {
          ownership.set(key, trade.toTeamId);
        }
      }
    }
  }

  return ownership;
}

export function OwnershipTable({ state }: OwnershipTableProps) {
  const ownership = rebuildOwnership(state);
  
  // Get unique years and rounds
  const years = Array.from(new Set(state.basePicks.map(p => p.year))).sort();
  const rounds = Array.from(new Set(state.basePicks.map(p => p.round))).sort();
  
  // Get team name by ID
  const getTeamName = (teamId: TeamId): string => {
    const team = state.teams.find(t => t.id === teamId);
    return team?.name || teamId;
  };

  // Get picks for a specific team, year, and round
  const getPicksForTeam = (teamId: TeamId, year: number, round: number) => {
    return state.basePicks.filter(
      p => p.year === year && p.round === round && p.originalOwnerId === teamId
    );
  };

  return (
    <section style={{ marginTop: '2rem' }}>
      <h2>Pick Ownership Matrix</h2>
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            borderCollapse: 'collapse',
            width: '100%',
            fontSize: '0.9rem',
            marginTop: '1rem',
          }}
        >
          <thead>
            {/* Year header row */}
            <tr>
              <th
                rowSpan={2}
                style={{
                  border: '1px solid #ddd',
                  padding: '0.5rem',
                  backgroundColor: '#f5f5f5',
                  textAlign: 'left',
                  position: 'sticky',
                  left: 0,
                  zIndex: 10,
                }}
              >
                Team
              </th>
              {years.map(year => (
                <th
                  key={year}
                  colSpan={rounds.length}
                  style={{
                    border: '1px solid #ddd',
                    padding: '0.5rem',
                    backgroundColor: '#f5f5f5',
                    textAlign: 'center',
                    fontWeight: 'bold',
                  }}
                >
                  {year}
                </th>
              ))}
            </tr>
            {/* Round sub-header row */}
            <tr>
              {years.map(year =>
                rounds.map(round => (
                  <th
                    key={`${year}-${round}`}
                    style={{
                      border: '1px solid #ddd',
                      padding: '0.5rem',
                      backgroundColor: '#f8f8f8',
                      textAlign: 'center',
                      minWidth: '120px',
                      fontSize: '0.85rem',
                    }}
                  >
                    R{round}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {state.teams.map(team => (
              <tr key={team.id}>
                <td
                  style={{
                    border: '1px solid #ddd',
                    padding: '0.5rem',
                    fontWeight: 'bold',
                    backgroundColor: '#f9f9f9',
                    position: 'sticky',
                    left: 0,
                    zIndex: 5,
                  }}
                >
                  {team.name}
                </td>
                {years.map(year =>
                  rounds.map(round => {
                    const picks = getPicksForTeam(team.id, year, round);
                    return (
                      <td
                        key={`${team.id}-${year}-${round}`}
                        style={{
                          border: '1px solid #ddd',
                          padding: '0.5rem',
                          verticalAlign: 'top',
                        }}
                      >
                        {picks.length > 0 ? (
                          <div>
                            {picks.map((pick, idx) => {
                              const key = `${pick.year}-${pick.round}-${pick.originalOwnerId}`;
                              const currentOwner = ownership.get(key);
                              const isOriginal = currentOwner === pick.originalOwnerId;
                              const isLocked = isPickLockedByStepienRule(state, team.id, pick.year, pick.round);
                              
                              return (
                                <div
                                  key={idx}
                                  style={{
                                    marginBottom: '0.25rem',
                                    padding: '0.25rem',
                                    backgroundColor: isLocked 
                                      ? '#ffebee' 
                                      : isOriginal 
                                        ? '#e8f5e9' 
                                        : '#fff3e0',
                                    borderRadius: '3px',
                                    fontSize: '0.85rem',
                                    border: isLocked ? '2px solid #f44336' : 'none',
                                    opacity: isLocked ? 0.7 : 1,
                                  }}
                                >
                                  {isLocked && (
                                    <div style={{ 
                                      color: '#d32f2f', 
                                      fontSize: '0.7rem', 
                                      fontWeight: 'bold',
                                      marginBottom: '0.25rem',
                                    }}>
                                      🔒 LOCKED
                                    </div>
                                  )}
                                  {isOriginal ? (
                                    <div style={{ fontWeight: 'bold', color: '#2e7d32' }}>
                                      ✓ Own
                                    </div>
                                  ) : (
                                    <div>
                                      <div style={{ color: '#666', fontSize: '0.75rem' }}>
                                        Original
                                      </div>
                                      <div style={{ color: '#d84315', fontWeight: 'bold' }}>
                                        → {getTeamName(currentOwner || '')}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span style={{ color: '#ccc' }}>—</span>
                        )}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

