import raw from './initialState.json';
import type { State } from '../types/state';

export const initialState: State = {
  teams: raw.teams,
  basePicks: raw.basePicks,
  trades: [] // no live trades stored in the JSON file
};

