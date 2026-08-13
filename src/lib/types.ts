export interface Player {
	id: string;
	name: string;
	position?: string;
	team?: string;
	rosterPct?: number;
	adp?: string;
	availableIn?: string[];
	locked?: boolean;
}

export interface League {
	id: string;
	name: string;
}

export type Tab = 'transactions' | 'waivers' | 'freeAgents';

export interface PlayerData {
	name: string;
	position: string;
	team?: string;
	rosterPct?: number;
	adp?: string;
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
	tradeGives?: Player[];
	tradeReceives?: Player[];
	transaction?: string;
	franchise1_gave_up?: string;
	franchise2_gave_up?: string;
	franchise2?: string;
	timestamp?: string;
	expires?: string;
	formattedTime?: string;
	addedPlayers?: Player[];
	droppedPlayers?: Player[];
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

export interface MFLPendingWaiverRequest {
	franchise?: string;
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
	addedPlayer?: Player;
	droppedPlayer?: Player;
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

export interface MFLPlayerNewsArticle {
	published?: string;
	id?: string;
	headline?: string;
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
	news?: {
		article?: MFLPlayerNewsArticle | MFLPlayerNewsArticle[];
	};
}

export interface MFLAdpPlayer {
	id: string;
	rank?: string;
	averagePick?: string;
}

export interface MFLAdpResponse {
	adp: {
		player: MFLAdpPlayer | MFLAdpPlayer[];
	};
}
