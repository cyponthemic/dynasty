import { useState } from 'react';
import type { State, TeamId, TradePickRef } from '../types/state';
import { validateNoDuplicatePicks, validateStepienRule, isPickLockedByStepienRule } from '../lib/tradeValidation';

type TradeFormProps = {
  state: State;
  onSubmit: (trade: {
    fromTeamId: TeamId;
    toTeamId: TeamId;
    picks: TradePickRef[];
    notes?: string;
  }) => Promise<void>;
  onCancel: () => void;
  onError: (message: string) => void;
};

type PickRow = {
  fromTeamId: TeamId;
  toTeamId: TeamId;
  year: number;
  round: number;
  originalOwnerId: TeamId;
};

export function TradeForm({ state, onSubmit, onCancel, onError }: TradeFormProps) {
  const [rows, setRows] = useState<PickRow[]>([
    {
      fromTeamId: state.teams[0]?.id || '',
      toTeamId: state.teams[1]?.id || '',
      year: new Date().getFullYear(),
      round: 1,
      originalOwnerId: state.teams[0]?.id || '',
    },
  ]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addRow = () => {
    setRows([
      ...rows,
      {
        fromTeamId: state.teams[0]?.id || '',
        toTeamId: state.teams[1]?.id || '',
        year: new Date().getFullYear(),
        round: 1,
        originalOwnerId: state.teams[0]?.id || '',
      },
    ]);
  };

  const removeRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof PickRow, value: string | number) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: value };
    setRows(newRows);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate all rows have required fields
      const invalidRows = rows.filter(
        (row) =>
          !row.fromTeamId ||
          !row.toTeamId ||
          !row.year ||
          !row.round ||
          !row.originalOwnerId
      );

      if (invalidRows.length > 0) {
        onError('Please fill in all fields for all picks');
        setIsSubmitting(false);
        return;
      }

      // Group picks by fromTeamId/toTeamId (assuming all picks in a trade go from same team to same team)
      // For simplicity, we'll use the first row's fromTeamId and toTeamId
      const fromTeamId = rows[0].fromTeamId;
      const toTeamId = rows[0].toTeamId;

      // Check if all rows have the same fromTeamId and toTeamId
      const allSameTeams = rows.every(
        (row) => row.fromTeamId === fromTeamId && row.toTeamId === toTeamId
      );

      if (!allSameTeams) {
        onError('All picks in a trade must be from the same team to the same team');
        setIsSubmitting(false);
        return;
      }

      const picks: TradePickRef[] = rows.map((row) => ({
        year: row.year,
        round: row.round,
        originalOwnerId: row.originalOwnerId,
      }));

      // Validate no duplicate picks
      const duplicateValidation = validateNoDuplicatePicks(picks);
      if (!duplicateValidation.ok) {
        onError(duplicateValidation.error || 'Duplicate picks found in trade');
        setIsSubmitting(false);
        return;
      }

      // Validate Stepien rule
      const stepienValidation = validateStepienRule(state, fromTeamId, picks);
      if (!stepienValidation.ok) {
        onError(stepienValidation.error || 'Stepien rule violation');
        setIsSubmitting(false);
        return;
      }

      await onSubmit({
        fromTeamId,
        toTeamId,
        picks,
        notes: notes.trim() || undefined,
      });

      // Reset form
      setRows([
        {
          fromTeamId: state.teams[0]?.id || '',
          toTeamId: state.teams[1]?.id || '',
          year: new Date().getFullYear(),
          round: 1,
          originalOwnerId: state.teams[0]?.id || '',
        },
      ]);
      setNotes('');
    } catch (error) {
      console.error('Error submitting trade:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1, currentYear + 2, currentYear + 3];

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        border: '1px solid #444',
        borderRadius: '8px',
        padding: '1.5rem',
        marginTop: '1rem',
        backgroundColor: '#2a2a2a',
      }}
    >
      <h3 style={{ marginTop: 0, color: '#f0f0f0' }}>Create New Trade</h3>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#f0f0f0' }}>
          Picks:
        </label>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.5rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#333' }}>
              <th style={{ padding: '0.5rem', border: '1px solid #444', fontSize: '0.85rem', color: '#f0f0f0' }}>
                From Team
              </th>
              <th style={{ padding: '0.5rem', border: '1px solid #444', fontSize: '0.85rem', color: '#f0f0f0' }}>
                To Team
              </th>
              <th style={{ padding: '0.5rem', border: '1px solid #444', fontSize: '0.85rem', color: '#f0f0f0' }}>
                Year
              </th>
              <th style={{ padding: '0.5rem', border: '1px solid #444', fontSize: '0.85rem', color: '#f0f0f0' }}>
                Round
              </th>
              <th style={{ padding: '0.5rem', border: '1px solid #444', fontSize: '0.85rem', color: '#f0f0f0' }}>
                Original Owner
              </th>
              <th style={{ padding: '0.5rem', border: '1px solid #444', fontSize: '0.85rem', color: '#f0f0f0' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isLocked = row.fromTeamId && row.round === 1 && 
                isPickLockedByStepienRule(state, row.fromTeamId, row.year, row.round);
              
              return (
              <tr key={index} style={{ backgroundColor: isLocked ? '#4a2a2a' : '#2a2a2a' }}>
                <td style={{ padding: '0.5rem', border: '1px solid #444' }}>
                  <select
                    value={row.fromTeamId}
                    onChange={(e) => updateRow(index, 'fromTeamId', e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '0.25rem',
                      backgroundColor: '#3a3a3a',
                      color: '#f0f0f0',
                      border: '1px solid #555',
                      borderRadius: '4px',
                    }}
                    required
                  >
                    <option value="">Select team</option>
                    {state.teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: '0.5rem', border: '1px solid #444' }}>
                  <select
                    value={row.toTeamId}
                    onChange={(e) => updateRow(index, 'toTeamId', e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '0.25rem',
                      backgroundColor: '#3a3a3a',
                      color: '#f0f0f0',
                      border: '1px solid #555',
                      borderRadius: '4px',
                    }}
                    required
                  >
                    <option value="">Select team</option>
                    {state.teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: '0.5rem', border: '1px solid #444' }}>
                  <select
                    value={row.year}
                    onChange={(e) => updateRow(index, 'year', parseInt(e.target.value))}
                    style={{ 
                      width: '100%', 
                      padding: '0.25rem',
                      backgroundColor: '#3a3a3a',
                      color: '#f0f0f0',
                      border: '1px solid #555',
                      borderRadius: '4px',
                    }}
                    required
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: '0.5rem', border: '1px solid #444' }}>
                  <select
                    value={row.round}
                    onChange={(e) => updateRow(index, 'round', parseInt(e.target.value))}
                    style={{ 
                      width: '100%', 
                      padding: '0.25rem',
                      backgroundColor: '#3a3a3a',
                      color: '#f0f0f0',
                      border: '1px solid #555',
                      borderRadius: '4px',
                    }}
                    required
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                  </select>
                </td>
                <td style={{ padding: '0.5rem', border: '1px solid #444' }}>
                  <select
                    value={row.originalOwnerId}
                    onChange={(e) => updateRow(index, 'originalOwnerId', e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '0.25rem',
                      backgroundColor: '#3a3a3a',
                      color: '#f0f0f0',
                      border: '1px solid #555',
                      borderRadius: '4px',
                    }}
                    required
                  >
                    <option value="">Select owner</option>
                    {state.teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: '0.5rem', border: '1px solid #444' }}>
                  {isLocked && (
                    <div style={{ 
                      color: '#ff6b6b', 
                      fontSize: '0.75rem', 
                      fontWeight: 'bold',
                      marginBottom: '0.25rem',
                    }}>
                      🔒 LOCKED (Stepien Rule)
                    </div>
                  )}
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
        <button
          type="button"
          onClick={addRow}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          + Add Pick
        </button>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#f0f0f0' }}>
          Notes (optional):
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #555',
            borderRadius: '4px',
            fontFamily: 'inherit',
            fontSize: '0.9rem',
            backgroundColor: '#3a3a3a',
            color: '#f0f0f0',
          }}
          rows={3}
          placeholder="Add any notes about this trade..."
        />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold',
            opacity: isSubmitting ? 0.6 : 1,
          }}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Trade'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

