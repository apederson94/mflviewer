export interface MFLLeague {
  id: string;
  name: string;
}

export interface PlayerInfo {
  name: string;
  position: string;
  team?: string;
  rosterPct?: number;
}

export interface MFLPlayer {
  id: string;
  name: string;
  position: string;
  salary?: string;
  contractYear?: string;
  cant_add?: string;
  locked?: string;
}

export interface TransactionPlayer {
  id: string;
  name: string;
  position?: string;
  team?: string;
  rosterPct?: number;
}

export interface MFLTopOwnsPlayer {
  id: string;
  percent: string;
}

export interface MFLTopOwnsResponse {
  topOwns: {
    player: MFLTopOwnsPlayer[];
  };
}

export interface MFLTransaction {
  id?: string;
  type: string;
  player?: string;
  franchise: string;
  week?: string;
  bid?: string;
  drafter?: string;
  responder?: string;
  players?: string;
  playerName?: string;
  playerNames?: string[];
  franchiseName?: string;
  tradePartnerName?: string;
  tradeGives?: TransactionPlayer[];
  tradeReceives?: TransactionPlayer[];
  transaction?: string;
  franchise1_gave_up?: string;
  franchise2_gave_up?: string;
  franchise2?: string;
  timestamp?: string;
  expires?: string;
  formattedTime?: string;
  addedPlayers?: TransactionPlayer[];
  droppedPlayers?: TransactionPlayer[];
  maxRosterPct?: number;
  leagueId?: string;
  leagueName?: string;
}

export interface MFLTransactionsResponse {
  transactions: {
    transaction: MFLTransaction | MFLTransaction[];
  };
}

export interface MFLMyLeague {
  league_id: string;
  name: string;
}

export interface MFLMyLeaguesResponse {
  leagues: {
    league: MFLMyLeague | MFLMyLeague[];
  };
}

export interface MFLPlayerDBEntry {
  id: string;
  name: string;
  position: string;
  team?: string;
}

export interface MFLPlayersResponse {
  players: {
    player: MFLPlayerDBEntry[];
  };
}

export interface MFLFreeAgentRaw {
  id: string;
  status?: string;
}

export interface MFLFreeAgentsResponse {
  freeAgents: {
    leagueUnit: {
      player: MFLFreeAgentRaw | MFLFreeAgentRaw[];
      unit: string;
    };
  };
}

export interface MFLFreeAgent {
  id: string;
  name: string;
  position?: string;
  team?: string;
  rosterPct?: number;
  locked?: boolean;
  availableIn: string[];
}

export interface StoredLeague {
  id: string;
  name: string;
}

export interface MFLFranchise {
  id: string;
  name: string;
}

export interface MFLLeagueResponse {
  league: {
    id: string;
    name: string;
    franchises?: {
      franchise: MFLFranchise | MFLFranchise[];
    };
  };
}

export interface MFLLoginResponse {
  success: boolean;
  cookie: string;
}

export interface MFLPendingWaiverRequest {
  comments: string;
  timestamp: string;
  round: string;
  addsDrops: string;
}

export interface MFLPendingWaiversResponse {
  pendingWaivers: {
    blindBidWaiverRequest: MFLPendingWaiverRequest | MFLPendingWaiverRequest[];
  };
}

export interface ParsedWaiverClaim {
  playerId: string;
  bid: string;
  dropPlayerId?: string;
  addedPlayer?: TransactionPlayer;
  droppedPlayer?: TransactionPlayer;
}

export interface MFLPendingWaiver {
  comments: string;
  timestamp: string;
  round: string;
  addsDrops: string;
  claims: ParsedWaiverClaim[];
  franchiseName?: string;
  formattedTime?: string;
  maxRosterPct?: number;
  leagueId?: string;
  leagueName?: string;
  commentsFormatted?: string;
}

export interface MFLPlayerProfile {
  name: string;
  id: string;
  player: {
    id: string;
    dob?: string;
    age?: string;
    height?: string;
    weight?: string;
    adp?: string;
  };
  news?: Record<string, unknown>;
}

export interface MFLPlayerProfileResponse {
  playerProfile: MFLPlayerProfile;
  version: string;
  encoding: string;
}

export interface ProfilePlayer {
  id: string;
  name: string;
  position?: string;
  team?: string;
  rosterPct?: number;
  availableIn?: string[];
}