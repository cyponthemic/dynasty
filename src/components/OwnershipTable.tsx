import type { State, TeamId } from '../types/state';

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

  // Get original owner IDs for each year/round combination
  const getOriginalOwners = (year: number, round: number): TeamId[] => {
    return Array.from(
      new Set(
        state.basePicks
          .filter(p => p.year === year && p.round === round)
          .map(p => p.originalOwnerId)
      )
    ).sort();
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
            <tr>
              <th
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
                Year / Round
              </th>
              {rounds.map(round => (
                <th
                  key={round}
                  style={{
                    border: '1px solid #ddd',
                    padding: '0.5rem',
                    backgroundColor: '#f5f5f5',
                    textAlign: 'center',
                    minWidth: '120px',
                  }}
                >
                  Round {round}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map(year => (
              <tr key={year}>
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
                  {year}
                </td>
                {rounds.map(round => {
                  const originalOwners = getOriginalOwners(year, round);
                  return (
                    <td
                      key={`${year}-${round}`}
                      style={{
                        border: '1px solid #ddd',
                        padding: '0.5rem',
                        verticalAlign: 'top',
                      }}
                    >
                      {originalOwners.length > 0 ? (
                        <div>
                          {originalOwners.map(originalOwnerId => {
                            const key = `${year}-${round}-${originalOwnerId}`;
                            const currentOwner = ownership.get(key);
                            const isOriginal = currentOwner === originalOwnerId;
                            
                            return (
                              <div
                                key={originalOwnerId}
                                style={{
                                  marginBottom: '0.25rem',
                                  padding: '0.25rem',
                                  backgroundColor: isOriginal ? '#e8f5e9' : '#fff3e0',
                                  borderRadius: '3px',
                                  fontSize: '0.85rem',
                                }}
                              >
                                <div style={{ fontWeight: 'bold', color: '#666' }}>
                                  {getTeamName(originalOwnerId)}
                                </div>
                                {!isOriginal && currentOwner && (
                                  <div style={{ color: '#d84315', fontSize: '0.8rem' }}>
                                    → {getTeamName(currentOwner)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span style={{ color: '#999' }}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

