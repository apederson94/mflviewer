import type {
	MFLTransaction,
	MFLPendingWaiver,
	MFLPendingWaiverRequest,
	MFLFreeAgentRaw,
	Player,
	PlayerData,
	ParsedWaiverClaim
} from './types';

export interface LeagueTransactionsResult {
	leagueId: string;
	leagueName: string;
	transactions: MFLTransaction[];
	franchiseMap: Map<string, string>;
}

export interface LeagueWaiversResult {
	leagueId: string;
	leagueName: string;
	waivers: MFLPendingWaiverRequest[];
	franchiseMap: Map<string, string>;
}

export interface LeagueFreeAgentsResult {
	leagueId: string;
	freeAgents: MFLFreeAgentRaw[];
}

export function getPlayerName(
	playerCache: Map<string, PlayerData>,
	playerId: string
): string {
	const player = playerCache.get(playerId);
	return player?.name || `Unknown (${playerId})`;
}

export function getPlayerPosition(
	playerCache: Map<string, PlayerData>,
	playerId: string
): string {
	const player = playerCache.get(playerId);
	return player?.position || 'UNK';
}

export function getFranchiseName(
	franchiseCache: Map<string, string>,
	franchiseId: string
): string {
	return franchiseCache.get(franchiseId) || `Franchise ${franchiseId}`;
}

export function formatDraftPick(pickId: string, currentYear?: string): string {
	const currentYr = currentYear || new Date().getFullYear().toString();

	const fpMatch = pickId.match(/^FP_(\d{4})_(\d{4})_(\d+)$/);
	if (fpMatch) {
		const [, , year, round] = fpMatch;
		const roundStr =
			round === '1'
				? '1st'
				: round === '2'
					? '2nd'
					: round === '3'
						? '3rd'
						: `${round}th`;
		return `${year} ${roundStr} Round Pick`;
	}

	const dpMatch = pickId.match(/^DP_(?<round>\d+)_(?<pick>\d+)$/);
	if (dpMatch) {
		const round = parseInt(dpMatch.groups?.['round'] ?? '0', 10) + 1;
		const pick = parseInt(dpMatch.groups?.['pick'] ?? '0', 10) + 1;
		return (
			currentYr +
			' Draft Pick ' +
			round +
			'.' +
			pick.toString().padStart(2, '0')
		);
	}

	return pickId;
}

export function formatFaab(id: string): string {
	const amount = id.replace(/^BB_/, '');
	return `FAAB $${amount}`;
}

export function formatTimestamp(timestamp: string): string {
	if (!timestamp) return '';
	const date = new Date(parseInt(timestamp, 10) * 1000);
	return date.toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});
}

export function getTransactionDisplayName(type: string): string {
	switch (type) {
		case 'FREE_AGENT':
			return 'Add/Drop';
		case 'TRADE':
			return 'Trade';
		case 'WAIVER':
			return 'Waiver';
		case 'BBID_WAIVER':
			return 'Waiver';
		default:
			return type;
	}
}

export function parseFreeAgentTransaction(transaction: string): {
	added: string[];
	dropped: string[];
} {
	const parts = transaction.split('|');
	const added =
		parts[0]
			?.split(',')
			.map((id) => id.trim())
			.filter(Boolean) || [];
	const dropped =
		parts[1]
			?.split(',')
			.map((id) => id.trim())
			.filter(Boolean) || [];
	return { added, dropped };
}

export function parseBBIDWaiverTransaction(transaction: string): {
	added: string[];
	dropped: string[];
	bid: string;
} {
	const parts = transaction.split('|');
	const added =
		parts[0]
			?.split(',')
			.map((id) => id.trim())
			.filter(Boolean) || [];
	const bid = parts[1]?.trim() || '';
	const dropped =
		parts[2]
			?.split(',')
			.map((id) => id.trim())
			.filter(Boolean) || [];
	return { added, dropped, bid };
}

export function resolveTradeItem(
	id: string,
	players: Map<string, PlayerData>,
	currentYear: string
): {
	id: string;
	name: string;
	position: string;
	team?: string;
	rosterPct?: number;
} {
	const cleanId = id.trim();
	if (cleanId.startsWith('BB_')) {
		return { id: cleanId, name: formatFaab(cleanId), position: 'FAAB' };
	}
	if (cleanId.startsWith('FP_') || cleanId.startsWith('DP_')) {
		return {
			id: cleanId,
			name: formatDraftPick(cleanId, currentYear),
			position: 'PICK'
		};
	}
	const rosterPct = players.get(cleanId)?.rosterPct;
	return {
		id: cleanId,
		name: getPlayerName(players, cleanId),
		position: getPlayerPosition(players, cleanId)?.toUpperCase(),
		team: players.get(cleanId)?.team,
		rosterPct
	};
}

function resolvePlayer(players: Map<string, PlayerData>, id: string): Player {
	const rosterPct = players.get(id)?.rosterPct;
	return {
		id,
		name: getPlayerName(players, id),
		position: getPlayerPosition(players, id)?.toUpperCase(),
		team: players.get(id)?.team,
		rosterPct
	};
}

export function enrichTransactions(
	results: LeagueTransactionsResult[],
	players: Map<string, PlayerData>,
	currentYear: string,
	includeTrades: boolean
): MFLTransaction[] {
	const allEnriched: MFLTransaction[] = [];
	for (const result of results) {
		const { leagueId: lid, leagueName, transactions, franchiseMap } = result;
		for (const t of transactions) {
			const franchiseName = getFranchiseName(franchiseMap, t.franchise);
			let enriched: MFLTransaction;

			if (t.type === 'TRADE') {
				const f1Gave = t.franchise1_gave_up?.split(',').filter(Boolean) || [];
				const f2Gave = t.franchise2_gave_up?.split(',').filter(Boolean) || [];

				const f1Names = f1Gave.map((id) =>
					resolveTradeItem(id, players, currentYear)
				);
				const f2Names = f2Gave.map((id) =>
					resolveTradeItem(id, players, currentYear)
				);

				const formattedTime = t.timestamp ? formatTimestamp(t.timestamp) : '';
				const allPlayers = [...f1Names, ...f2Names];
				const maxRosterPct = Math.max(
					...allPlayers.map((p) => p.rosterPct ?? 0),
					0
				);

				enriched = {
					...t,
					type: getTransactionDisplayName(t.type),
					playerNames: [
						...f1Names.map((p) => p.name),
						...f2Names.map((p) => p.name)
					],
					playerName: [
						...f1Names.map((p) => p.name),
						...f2Names.map((p) => p.name)
					].join(', '),
					franchiseName,
					tradePartnerName: t.franchise2
						? getFranchiseName(franchiseMap, t.franchise2)
						: undefined,
					tradeGives: f1Names,
					tradeReceives: f2Names,
					formattedTime,
					maxRosterPct,
					leagueId: lid,
					leagueName
				};
			} else {
				let bid: string | undefined;
				let added: string[];
				let dropped: string[];
				if (t.type === 'BBID_WAIVER' && t.transaction) {
					const parsed = parseBBIDWaiverTransaction(t.transaction);
					added = parsed.added;
					dropped = parsed.dropped;
					bid = parsed.bid;
				} else if (t.transaction) {
					const parsed = parseFreeAgentTransaction(t.transaction);
					added = parsed.added;
					dropped = parsed.dropped;
					bid = t.bid;
				} else {
					added = [];
					dropped = [];
					bid = t.bid;
				}

				const addedPlayers = added.map((id) => resolvePlayer(players, id));
				const droppedPlayers = dropped.map((id) => resolvePlayer(players, id));

				const formattedTime = t.timestamp ? formatTimestamp(t.timestamp) : '';
				const maxRosterPct = Math.max(
					...droppedPlayers.map((p) => p.rosterPct ?? 0),
					0
				);
				enriched = {
					...t,
					type: getTransactionDisplayName(t.type),
					addedPlayers,
					droppedPlayers,
					playerNames: [
						...addedPlayers.map((p) => p.name),
						...droppedPlayers.map((p) => p.name)
					],
					playerName:
						[
							...addedPlayers.map((p) => p.name),
							...droppedPlayers.map((p) => p.name)
						].join(', ') || undefined,
					franchiseName,
					formattedTime,
					bid,
					maxRosterPct,
					leagueId: lid,
					leagueName
				};
			}
			allEnriched.push(enriched);
		}
	}

	const filtered = includeTrades
		? allEnriched
		: allEnriched.filter((t) => t.type !== 'Trade');
	filtered.sort((a, b) => {
		const pctDiff = (b.maxRosterPct || 0) - (a.maxRosterPct || 0);
		if (pctDiff !== 0) return pctDiff;
		return parseInt(b.timestamp || '0', 10) - parseInt(a.timestamp || '0', 10);
	});
	return filtered;
}

export function enrichPendingWaivers(
	results: LeagueWaiversResult[],
	players: Map<string, PlayerData>
): MFLPendingWaiver[] {
	const allEnriched: MFLPendingWaiver[] = [];
	for (const result of results) {
		const { leagueId: lid, leagueName, waivers, franchiseMap } = result;
		for (const w of waivers) {
			const claims: ParsedWaiverClaim[] = w.addsDrops
				.split(',')
				.map((claim) => {
					const parts = claim.split('_');
					const playerId = parts[0] || '';
					const bid = parts[1] || '0';
					const dropId = parts[2];
					const dropPlayerId = dropId && dropId !== '0000' ? dropId : undefined;

					const addedPlayer = resolvePlayer(players, playerId);

					const droppedPlayer = dropPlayerId
						? resolvePlayer(players, dropPlayerId)
						: undefined;

					return {
						playerId,
						bid,
						dropPlayerId,
						addedPlayer,
						droppedPlayer
					};
				});

			const allPlayers = claims.flatMap((c) =>
				[c.addedPlayer, c.droppedPlayer].filter((p): p is Player => Boolean(p))
			);
			const maxRosterPct = Math.max(
				...allPlayers.map((p) => p.rosterPct ?? 0),
				0
			);
			const commentsFormatted = w.comments.replace(/br\//g, '\n');
			const franchiseName = w.franchise
				? getFranchiseName(franchiseMap, w.franchise)
				: 'Your Team';

			allEnriched.push({
				...w,
				claims,
				maxRosterPct,
				formattedTime: formatTimestamp(w.timestamp),
				commentsFormatted,
				franchiseName,
				leagueId: lid,
				leagueName
			});
		}
	}

	allEnriched.sort((a, b) => (b.maxRosterPct || 0) - (a.maxRosterPct || 0));
	return allEnriched;
}

export function enrichFreeAgents(
	results: LeagueFreeAgentsResult[],
	players: Map<string, PlayerData>
): Player[] {
	const unionMap = new Map<
		string,
		{ id: string; locked: boolean; availableIn: string[] }
	>();
	for (const result of results) {
		const { leagueId: lid, freeAgents } = result;
		for (const fa of freeAgents) {
			const existing = unionMap.get(fa.id);
			if (existing) {
				existing.locked = existing.locked || fa.status === 'locked';
				existing.availableIn.push(lid);
			} else {
				unionMap.set(fa.id, {
					id: fa.id,
					locked: fa.status === 'locked',
					availableIn: [lid]
				});
			}
		}
	}

	const freeAgents: Player[] = [...unionMap.values()].map((p) => ({
		id: p.id,
		name: getPlayerName(players, p.id),
		position: getPlayerPosition(players, p.id)?.toUpperCase(),
		team: players.get(p.id)?.team,
		rosterPct: players.get(p.id)?.rosterPct,
		locked: p.locked,
		availableIn: p.availableIn
	}));

	freeAgents.sort((a, b) => {
		if (!!a.locked !== !!b.locked) return a.locked ? 1 : -1;
		return (b.rosterPct || 0) - (a.rosterPct || 0);
	});

	return freeAgents;
}
