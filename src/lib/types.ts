export interface MFLLeague {
  id: string;
  name: string;
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
  tradeGives?: string[];
  tradeReceives?: string[];
  transaction?: string;
  franchise1_gave_up?: string;
  franchise2_gave_up?: string;
  franchise2?: string;
  timestamp?: string;
  expires?: string;
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
}

export interface MFLPlayersResponse {
  players: {
    player: MFLPlayerDBEntry[];
  };
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