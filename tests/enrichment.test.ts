import { describe, expect, it } from 'vitest';
import type {
	MFLFreeAgentRaw,
	MFLPendingWaiverRequest,
	MFLTransaction,
	PlayerData
} from '../src/lib/types';
import {
	enrichFreeAgents,
	enrichPendingWaivers,
	enrichTransactions,
	formatDraftPick,
	formatFaab,
	formatTimestamp,
	getFranchiseName,
	getPlayerName,
	getPlayerPosition,
	getTransactionDisplayName,
	parseBBIDWaiverTransaction,
	parseFreeAgentTransaction,
	resolveTradeItem,
	type LeagueFreeAgentsResult,
	type LeagueTransactionsResult,
	type LeagueWaiversResult
} from '../src/lib/enrichment';

function makePlayers(): Map<string, PlayerData> {
	const players = new Map<string, PlayerData>();
	players.set('1111', {
		name: 'Player A',
		position: 'RB',
		team: 'KC',
		rosterPct: 50
	});
	players.set('2222', {
		name: 'Player B',
		position: 'WR',
		team: 'GB',
		rosterPct: 80
	});
	players.set('3333', {
		name: 'Player C',
		position: 'QB',
		team: 'SF',
		rosterPct: 90
	});
	players.set('4444', {
		name: 'Player D',
		position: 'TE',
		team: 'PHI',
		rosterPct: 40
	});
	return players;
}

describe('formatDraftPick', () => {
	it('formats a first-round future pick', () => {
		expect(formatDraftPick('FP_2026_2026_1', '2026')).toBe(
			'2026 1st Round Pick'
		);
	});

	it('formats a future pick with ordinal round', () => {
		expect(formatDraftPick('FP_2027_2026_2', '2026')).toBe(
			'2026 2nd Round Pick'
		);
		expect(formatDraftPick('FP_2028_2026_3', '2026')).toBe(
			'2026 3rd Round Pick'
		);
		expect(formatDraftPick('FP_2029_2026_5', '2026')).toBe(
			'2026 5th Round Pick'
		);
	});

	it('formats a current-year draft pick', () => {
		expect(formatDraftPick('DP_0_0', '2026')).toBe('2026 Draft Pick 1.01');
		expect(formatDraftPick('DP_2_10', '2026')).toBe('2026 Draft Pick 3.11');
	});

	it('uses the current year when none is given', () => {
		expect(formatDraftPick('DP_0_0')).toMatch(/^\d{4} Draft Pick 1\.01$/);
	});

	it('returns the raw id for unknown formats', () => {
		expect(formatDraftPick('WHATEVER')).toBe('WHATEVER');
	});
});

describe('formatFaab', () => {
	it('formats an FAAB id', () => {
		expect(formatFaab('BB_1500')).toBe('FAAB $1500');
	});

	it('returns just the amount for a bare id', () => {
		expect(formatFaab('BB_0')).toBe('FAAB $0');
	});
});

describe('formatTimestamp', () => {
	it('returns an empty string for no timestamp', () => {
		expect(formatTimestamp('')).toBe('');
	});

	it('formats a unix timestamp', () => {
		expect(formatTimestamp('1700000000')).toContain('2023');
	});
});

describe('getTransactionDisplayName', () => {
	it('maps known MFL types to display names', () => {
		expect(getTransactionDisplayName('FREE_AGENT')).toBe('Add/Drop');
		expect(getTransactionDisplayName('TRADE')).toBe('Trade');
		expect(getTransactionDisplayName('WAIVER')).toBe('Waiver');
		expect(getTransactionDisplayName('BBID_WAIVER')).toBe('Waiver');
	});

	it('returns the raw type for unknown types', () => {
		expect(getTransactionDisplayName('MYSTERY')).toBe('MYSTERY');
	});
});

describe('parseFreeAgentTransaction', () => {
	it('parses added and dropped ids', () => {
		expect(parseFreeAgentTransaction('12,34|56')).toEqual({
			added: ['12', '34'],
			dropped: ['56']
		});
	});

	it('trims whitespace and drops empties', () => {
		expect(parseFreeAgentTransaction(' 12 , , 34 |')).toEqual({
			added: ['12', '34'],
			dropped: []
		});
	});

	it('handles empty input', () => {
		expect(parseFreeAgentTransaction('')).toEqual({ added: [], dropped: [] });
	});
});

describe('parseBBIDWaiverTransaction', () => {
	it('parses added, bid, and dropped ids', () => {
		expect(parseBBIDWaiverTransaction('12,34|1500|56')).toEqual({
			added: ['12', '34'],
			bid: '1500',
			dropped: ['56']
		});
	});

	it('handles a missing bid', () => {
		expect(parseBBIDWaiverTransaction('12| |56')).toEqual({
			added: ['12'],
			bid: '',
			dropped: ['56']
		});
	});
});

describe('lookup helpers', () => {
	const players = makePlayers();

	it('getPlayerName falls back to Unknown', () => {
		expect(getPlayerName(players, '1111')).toBe('Player A');
		expect(getPlayerName(players, '9999')).toBe('Unknown (9999)');
	});

	it('getPlayerPosition falls back to UNK', () => {
		expect(getPlayerPosition(players, '1111')).toBe('RB');
		expect(getPlayerPosition(players, '9999')).toBe('UNK');
	});

	it('getFranchiseName falls back to a numbered name', () => {
		const franchises = new Map([['0001', 'Team One']]);
		expect(getFranchiseName(franchises, '0001')).toBe('Team One');
		expect(getFranchiseName(franchises, '0002')).toBe('Franchise 0002');
	});
});

describe('resolveTradeItem', () => {
	const players = makePlayers();

	it('resolves FAAB items', () => {
		expect(resolveTradeItem('BB_500', players, '2026')).toEqual({
			id: 'BB_500',
			name: 'FAAB $500',
			position: 'FAAB'
		});
	});

	it('resolves draft picks', () => {
		expect(resolveTradeItem('DP_0_0', players, '2026')).toEqual({
			id: 'DP_0_0',
			name: '2026 Draft Pick 1.01',
			position: 'PICK'
		});
	});

	it('resolves players with metadata', () => {
		expect(resolveTradeItem('1111', players, '2026')).toEqual({
			id: '1111',
			name: 'Player A',
			position: 'RB',
			team: 'KC',
			rosterPct: 50
		});
	});
});

describe('enrichTransactions', () => {
	const players = makePlayers();

	function result(
		transactions: MFLTransaction[],
		leagueId = 'L1'
	): LeagueTransactionsResult {
		return {
			leagueId,
			leagueName: `League ${leagueId}`,
			transactions,
			franchiseMap: new Map([
				['0001', 'Team One'],
				['0002', 'Team Two']
			])
		};
	}

	it('enriches trades with names, sides, and roster pct', () => {
		const transactions: MFLTransaction[] = [
			{
				id: 't1',
				type: 'TRADE',
				franchise: '0001',
				franchise2: '0002',
				franchise1_gave_up: '1111,BB_500',
				franchise2_gave_up: '2222',
				timestamp: '1000'
			}
		];

		const [t] = enrichTransactions(
			[result(transactions)],
			players,
			'2026',
			true
		);

		expect(t.type).toBe('Trade');
		expect(t.franchiseName).toBe('Team One');
		expect(t.tradePartnerName).toBe('Team Two');
		expect(t.leagueId).toBe('L1');
		expect(t.leagueName).toBe('League L1');
		expect(t.tradeGives?.map((p) => p.name)).toEqual(['Player A', 'FAAB $500']);
		expect(t.tradeReceives?.map((p) => p.name)).toEqual(['Player B']);
		expect(t.maxRosterPct).toBe(80);
	});

	it('enriches add/drops with bid and player lists', () => {
		const transactions: MFLTransaction[] = [
			{
				id: 't1',
				type: 'FREE_AGENT',
				franchise: '0001',
				transaction: '1111|2222',
				bid: '10',
				timestamp: '2000'
			}
		];

		const [t] = enrichTransactions(
			[result(transactions)],
			players,
			'2026',
			true
		);

		expect(t.type).toBe('Add/Drop');
		expect(t.addedPlayers?.map((p) => p.id)).toEqual(['1111']);
		expect(t.droppedPlayers?.map((p) => p.id)).toEqual(['2222']);
		expect(t.playerName).toBe('Player A, Player B');
		expect(t.bid).toBe('10');
		expect(t.maxRosterPct).toBe(80);
	});

	it('parses BBID waiver bids from the transaction string', () => {
		const transactions: MFLTransaction[] = [
			{
				id: 't1',
				type: 'BBID_WAIVER',
				franchise: '0001',
				transaction: '1111|500|2222',
				timestamp: '2000'
			}
		];

		const [t] = enrichTransactions(
			[result(transactions)],
			players,
			'2026',
			true
		);

		expect(t.type).toBe('Waiver');
		expect(t.bid).toBe('500');
		expect(t.addedPlayers?.map((p) => p.id)).toEqual(['1111']);
	});

	it('filters out trades when includeTrades is false', () => {
		const transactions: MFLTransaction[] = [
			{
				id: 't1',
				type: 'TRADE',
				franchise: '0001',
				franchise2: '0002',
				franchise1_gave_up: '1111',
				franchise2_gave_up: '2222',
				timestamp: '1000'
			},
			{
				id: 't2',
				type: 'FREE_AGENT',
				franchise: '0001',
				transaction: '1111|2222',
				timestamp: '2000'
			}
		];

		const enriched = enrichTransactions(
			[result(transactions)],
			players,
			'2026',
			false
		);

		expect(enriched).toHaveLength(1);
		expect(enriched[0].id).toBe('t2');
	});

	it('sorts by roster pct desc, then timestamp desc', () => {
		const transactions: MFLTransaction[] = [
			{
				id: 't-old',
				type: 'FREE_AGENT',
				franchise: '0001',
				transaction: '1111|4444',
				timestamp: '1000'
			},
			{
				id: 't-new',
				type: 'FREE_AGENT',
				franchise: '0001',
				transaction: '2222|1111',
				timestamp: '2000'
			}
		];

		const enriched = enrichTransactions(
			[result(transactions)],
			players,
			'2026',
			true
		);

		expect(enriched.map((t) => t.id)).toEqual(['t-new', 't-old']);
	});
});

describe('enrichPendingWaivers', () => {
	const players = makePlayers();

	function result(waivers: MFLPendingWaiverRequest[]): LeagueWaiversResult {
		return {
			leagueId: 'L1',
			leagueName: 'League L1',
			waivers,
			franchiseMap: new Map([['0001', 'Team One']])
		};
	}

	it('parses claims including a player-only drop placeholder', () => {
		const waivers: MFLPendingWaiverRequest[] = [
			{
				franchise: '0001',
				comments: 'line1br/line2',
				timestamp: '3000',
				round: '1',
				addsDrops: '1111_100_2222,3333_50_0000'
			}
		];

		const [w] = enrichPendingWaivers([result(waivers)], players);

		expect(w.franchiseName).toBe('Team One');
		expect(w.leagueId).toBe('L1');
		expect(w.commentsFormatted).toBe('line1\nline2');
		expect(w.claims).toHaveLength(2);

		const [withDrop, playerOnly] = w.claims;
		expect(withDrop.playerId).toBe('1111');
		expect(withDrop.bid).toBe('100');
		expect(withDrop.dropPlayerId).toBe('2222');
		expect(withDrop.addedPlayer?.name).toBe('Player A');
		expect(withDrop.droppedPlayer?.name).toBe('Player B');

		expect(playerOnly.dropPlayerId).toBeUndefined();
		expect(playerOnly.droppedPlayer).toBeUndefined();
		expect(playerOnly.addedPlayer?.name).toBe('Player C');
	});

	it('falls back to "Your Team" when franchise is missing', () => {
		const waivers: MFLPendingWaiverRequest[] = [
			{
				comments: '',
				timestamp: '3000',
				round: '1',
				addsDrops: '1111_0_0000'
			}
		];

		const [w] = enrichPendingWaivers([result(waivers)], players);

		expect(w.franchiseName).toBe('Your Team');
	});

	it('sorts by roster pct desc', () => {
		const waivers: MFLPendingWaiverRequest[] = [
			{
				franchise: '0001',
				comments: '',
				timestamp: '3000',
				round: '1',
				addsDrops: '1111_0_0000'
			},
			{
				franchise: '0001',
				comments: '',
				timestamp: '3000',
				round: '1',
				addsDrops: '3333_0_0000'
			}
		];

		const [top, bottom] = enrichPendingWaivers([result(waivers)], players);

		expect(top.claims[0].addedPlayer?.name).toBe('Player C');
		expect(bottom.claims[0].addedPlayer?.name).toBe('Player A');
	});
});

describe('enrichFreeAgents', () => {
	const players = makePlayers();

	function result(
		leagueId: string,
		freeAgents: MFLFreeAgentRaw[]
	): LeagueFreeAgentsResult {
		return { leagueId, freeAgents };
	}

	it('unions free agents across leagues', () => {
		const results = [
			result('L1', [{ id: '1111', status: 'locked' }, { id: '2222' }]),
			result('L2', [{ id: '2222' }, { id: '3333' }])
		];

		const freeAgents = enrichFreeAgents(results, players);

		const byId = new Map(freeAgents.map((p) => [p.id, p]));
		expect(byId.get('1111')).toMatchObject({
			locked: true,
			availableIn: ['L1']
		});
		expect(byId.get('2222')).toMatchObject({
			locked: false,
			availableIn: ['L1', 'L2']
		});
		expect(byId.get('3333')).toMatchObject({
			locked: false,
			availableIn: ['L2']
		});
	});

	it('keeps a player locked if locked in any league', () => {
		const results = [
			result('L1', [{ id: '2222', status: 'locked' }]),
			result('L2', [{ id: '2222' }])
		];

		const [fa] = enrichFreeAgents(results, players);

		expect(fa.locked).toBe(true);
	});

	it('sorts unlocked players before locked, then by roster pct desc', () => {
		const results = [
			result('L1', [
				{ id: '1111', status: 'locked' },
				{ id: '2222' },
				{ id: '3333' }
			])
		];

		const freeAgents = enrichFreeAgents(results, players);

		expect(freeAgents.map((p) => p.id)).toEqual(['3333', '2222', '1111']);
	});

	it('enriches player metadata', () => {
		const results = [result('L1', [{ id: '2222' }])];

		const [fa] = enrichFreeAgents(results, players);

		expect(fa).toMatchObject({
			id: '2222',
			name: 'Player B',
			position: 'WR',
			team: 'GB',
			rosterPct: 80
		});
	});
});
