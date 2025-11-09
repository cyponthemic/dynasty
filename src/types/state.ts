export type TeamId = string;

export type Team = {
  id: TeamId;      // stable slug, e.g. "gtd_pussies"
  name: string;    // UI name, e.g. "GTD PUSSIES"
};

export type Pick = {
  year: number;            // e.g. 2026
  round: number;           // e.g. 1
  originalOwnerId: TeamId; // team that "minted" the pick
  currentOwnerId: TeamId;  // who owns it at baseline (after old trades)
};

// Reference to a pick used inside a Trade.
// We DO NOT copy currentOwnerId here; trades change that.
export type TradePickRef = {
  year: number;
  round: number;
  originalOwnerId: TeamId;
};

export type Trade = {
  id: string;
  createdAt: string;
  fromTeamId: TeamId;
  toTeamId: TeamId;
  picks: TradePickRef[];
  notes?: string;
};

export type State = {
  teams: Team[];
  basePicks: Pick[];
  trades: Trade[]; // dynamic, stored in Netlify Blobs
};

