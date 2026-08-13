import type {
	MFLTransactionsResponse,
	MFLTransaction,
	MFLMyLeaguesResponse,
	MFLPlayersResponse,
	MFLTopOwnsResponse,
	MFLPendingWaiversResponse,
	MFLPendingWaiverRequest,
	MFLFreeAgentsResponse,
	MFLFreeAgentRaw,
	StoredLeague,
	MFLLeagueResponse,
	MFLAdpResponse,
	PlayerData
} from './types';

import { resetImageCacheIfStale } from './playerImages';

export const MFL_COOKIE_NAME = 'mfl_cookie';

function toArray<T>(item: T | T[]): T[] {
	return Array.isArray(item) ? item : [item];
}

interface YearWeekCache {
	year: string;
	week: number;
	timestamp: number;
}

let yearWeekCache: YearWeekCache | null = null;

interface LeagueFullCacheEntry {
	league: LeagueFull;
	timestamp: number;
}

const leagueFullCache = new Map<string, LeagueFullCacheEntry>();
const LEAGUE_CACHE_TTL_MS = 60 * 60 * 1000;

interface PlayerCache {
	players: Map<string, PlayerData>;
	timestamp: number;
}

let playerCache: PlayerCache | null = null;

function isCacheValid(cache: YearWeekCache | null): boolean {
	if (!cache) return false;
	const now = new Date();
	const cacheDate = new Date(cache.timestamp);
	return now.toDateString() === cacheDate.toDateString();
}

function isPlayerCacheValid(): boolean {
	if (!playerCache) return false;
	const now = new Date();
	const cacheDate = new Date(playerCache.timestamp);
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const cacheDay = new Date(
		cacheDate.getFullYear(),
		cacheDate.getMonth(),
		cacheDate.getDate()
	);
	return today.getTime() === cacheDay.getTime();
}

export async function getYearAndWeek(): Promise<{
	year: string;
	week: number;
}> {
	if (isCacheValid(yearWeekCache)) {
		return { year: yearWeekCache!.year, week: yearWeekCache!.week };
	}
	const url =
		'https://api.myfantasyleague.com/fflnetdynamic2026/mfl_status.json';
	const response = await fetchJSON<{
		mfl_status: { year: string; weeks: { CurrentWeek: string } };
	}>(url);
	yearWeekCache = {
		year: response.mfl_status.year,
		week: parseInt(response.mfl_status.weeks.CurrentWeek || '1', 10),
		timestamp: Date.now()
	};
	return { year: yearWeekCache.year, week: yearWeekCache.week };
}

export async function getCurrentYear(): Promise<string> {
	const { year } = await getYearAndWeek();
	return year;
}

export async function getCurrentWeek(): Promise<number> {
	const { week } = await getYearAndWeek();
	return week;
}

export async function getBaseUrl(): Promise<string> {
	const year = await getCurrentYear();
	return `https://api.myfantasyleague.com/${year}/export`;
}

export async function fetchJSON<T>(
	url: string,
	cookie?: string,
	retries = 2
): Promise<T> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	};

	if (cookie) {
		headers['Cookie'] = cookie;
	}

	let response: Response;
	for (let attempt = 0; ; attempt++) {
		response = await fetch(url, { headers });
		if (response.status === 429 && attempt < retries) {
			await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
			continue;
		}
		break;
	}

	if (!response.ok) {
		throw new Error(`MFL API error: ${response.status}`);
	}

	const text = await response.text();

	if (!text) {
		throw new Error('Empty response from API');
	}

	return JSON.parse(text) as T;
}

export async function login(
	username: string,
	password: string
): Promise<{ success: boolean; cookie: string }> {
	const year = await getCurrentYear();
	const encodedUsername = encodeURIComponent(username);
	const encodedPassword = encodeURIComponent(password);
	const loginUrl = `https://api.myfantasyleague.com/${year}/login?USERNAME=${encodedUsername}&PASSWORD=${encodedPassword}&XML=1`;

	const response = await fetch(loginUrl);
	const text = await response.text();

	if (!text) {
		return { success: false, cookie: '' };
	}

	if (text.includes('<error')) {
		return { success: false, cookie: '' };
	}

	const cookieMatch = text.match(/MFL_USER_ID="([^"]+)"/);

	if (cookieMatch) {
		const cookieValue = cookieMatch[1];
		return {
			success: true,
			cookie: `MFL_USER_ID=${cookieValue}`
		};
	}

	return { success: false, cookie: '' };
}

export async function getMyLeagues(cookie?: string): Promise<StoredLeague[]> {
	const baseUrl = await getBaseUrl();
	const url = `${baseUrl}?TYPE=myleagues&JSON=1`;

	try {
		const response = await fetchJSON<MFLMyLeaguesResponse>(url, cookie);
		const leagues = response.leagues?.league
			? toArray(response.leagues.league)
			: [];

		return leagues.map((league) => ({
			id: league.league_id,
			name: league.name
		}));
	} catch (error) {
		console.error(`Fetch leagues failed: ${error}`);
		throw error;
	}
}

export interface LeagueFull {
	id: string;
	name: string;
	franchises: Map<string, string>;
}

export async function getLeagueFull(
	leagueId: string,
	cookie?: string
): Promise<LeagueFull | null> {
	const cached = leagueFullCache.get(leagueId);
	if (cached && Date.now() - cached.timestamp < LEAGUE_CACHE_TTL_MS) {
		return cached.league;
	}

	const baseUrl = await getBaseUrl();
	const url = `${baseUrl}?TYPE=league&L=${leagueId}&JSON=1`;

	const franchiseMap = new Map<string, string>();

	try {
		const response = await fetchJSON<MFLLeagueResponse>(url, cookie);

		const leagueIdVal = response.league?.id || leagueId;
		const leagueName = response.league?.name || 'Unknown League';

		if (response.league?.franchises?.franchise) {
			const franchises = toArray(response.league.franchises.franchise);
			franchises.forEach((franchise) => {
				franchiseMap.set(franchise.id, franchise.name);
			});
		}

		const league: LeagueFull = {
			id: leagueIdVal,
			name: leagueName,
			franchises: franchiseMap
		};

		leagueFullCache.set(leagueIdVal, { league, timestamp: Date.now() });

		return league;
	} catch (error) {
		console.error(`Fetch full league ${leagueId} failed: ${error}`);
		return null;
	}
}

let playerCachePromise: Promise<Map<string, PlayerData>> | null = null;

export async function loadPlayerCache(
	cookie?: string
): Promise<Map<string, PlayerData>> {
	if (isPlayerCacheValid() && playerCache) {
		return playerCache.players;
	}

	if (playerCachePromise) {
		return playerCachePromise;
	}

	playerCachePromise = (async () => {
		const baseUrl = await getBaseUrl();
		const playersUrl = `${baseUrl}?TYPE=players&JSON=1`;
		const ownsUrl = `${baseUrl}?TYPE=topOwns&JSON=1&COUNT=10000`;
		const adpUrl = `${baseUrl}?TYPE=adp&JSON=1`;
		const playerCacheMap = new Map<string, PlayerData>();

		const [playerRes, ownsRes, adpRes] = await Promise.allSettled([
			fetchJSON<MFLPlayersResponse>(playersUrl, cookie),
			fetchJSON<MFLTopOwnsResponse>(ownsUrl),
			fetchJSON<MFLAdpResponse>(adpUrl)
		]);

		if (playerRes.status === 'rejected') {
			throw new Error(
				`Failed to load players: ${
					playerRes.reason instanceof Error
						? playerRes.reason.message
						: String(playerRes.reason)
				}`
			);
		}

		if (playerRes.value.players?.player) {
			const players = toArray(playerRes.value.players.player);
			players.forEach((player) => {
				playerCacheMap.set(player.id, {
					name: player.name,
					position: player.position,
					team: player.team
				});
			});
		}

		if (ownsRes.status === 'fulfilled' && ownsRes.value.topOwns?.player) {
			const owns = toArray(ownsRes.value.topOwns.player);
			owns.forEach(({ id, percent }) => {
				const existing = playerCacheMap.get(id);
				if (existing) {
					existing.rosterPct = parseFloat(percent);
				}
			});
		}

		if (adpRes.status === 'fulfilled' && adpRes.value.adp?.player) {
			const adp = toArray(adpRes.value.adp.player);
			adp.forEach(({ id, averagePick }) => {
				if (!averagePick) return;
				const existing = playerCacheMap.get(id);
				if (existing) {
					existing.adp = averagePick;
				} else {
					playerCacheMap.set(id, {
						name: '',
						position: '',
						adp: averagePick
					});
				}
			});
		}

		playerCache = {
			players: playerCacheMap,
			timestamp: Date.now()
		};

		resetImageCacheIfStale();

		return playerCacheMap;
	})().finally(() => {
		playerCachePromise = null;
	});

	return playerCachePromise;
}

export async function getTopRosteredPlayerIds(count = 1000): Promise<string[]> {
	const baseUrl = await getBaseUrl();
	const ownsUrl = `${baseUrl}?TYPE=topOwns&JSON=1&COUNT=10000`;

	try {
		const response = await fetchJSON<MFLTopOwnsResponse>(ownsUrl);
		const owns = response.topOwns?.player
			? toArray(response.topOwns.player)
			: [];
		return owns.slice(0, count).map((p) => p.id);
	} catch (error) {
		console.error(`Fetch top owns failed: ${error}`);
		return [];
	}
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

	const dpMatch = pickId.match(/^DP_(\d+)_(\d+)$/);
	if (dpMatch) {
		const round = parseInt(dpMatch[1], 10) + 1;
		const pick = parseInt(dpMatch[2], 10) + 1;
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

export async function getTransactions(
	leagueId: string,
	cookie?: string,
	days?: number
): Promise<MFLTransaction[]> {
	const baseUrl = await getBaseUrl();
	const base = `TYPE=transactions&L=${leagueId}&JSON=1`;

	const timeParam = days ? `&DAYS=${days}` : '';

	const waiversUrl = `${baseUrl}?${base}&TRANS_TYPE=BBID_WAIVER,WAIVER${timeParam}`;
	const otherUrl = `${baseUrl}?${base}&TRANS_TYPE=FREE_AGENT,TRADE${timeParam}`;

	try {
		const [waiversRes, otherRes] = await Promise.all([
			fetchJSON<MFLTransactionsResponse>(waiversUrl, cookie),
			fetchJSON<MFLTransactionsResponse>(otherUrl, cookie)
		]);

		const waivers = waiversRes.transactions?.transaction
			? toArray(waiversRes.transactions.transaction)
			: [];
		const other = otherRes.transactions?.transaction
			? toArray(otherRes.transactions.transaction)
			: [];

		const merged = [...waivers, ...other];
		merged.sort(
			(a, b) =>
				parseInt(b.timestamp || '0', 10) - parseInt(a.timestamp || '0', 10)
		);

		return merged;
	} catch (error) {
		console.error(`Fetch transactions for league ${leagueId} failed: ${error}`);
		throw error;
	}
}

export async function getPendingWaivers(
	leagueId: string,
	cookie?: string
): Promise<MFLPendingWaiverRequest[]> {
	const baseUrl = await getBaseUrl();
	const url = `${baseUrl}?TYPE=pendingWaivers&L=${leagueId}&JSON=1`;

	try {
		const response = await fetchJSON<MFLPendingWaiversResponse>(url, cookie);
		const requests = response.pendingWaivers?.blindBidWaiverRequest;
		return requests ? toArray(requests) : [];
	} catch (error) {
		console.error(
			`Fetch pending waivers for league ${leagueId} failed: ${error}`
		);
		throw error;
	}
}

export async function getFreeAgents(
	leagueId: string,
	cookie?: string
): Promise<MFLFreeAgentRaw[]> {
	const baseUrl = await getBaseUrl();
	const url = `${baseUrl}?TYPE=freeAgents&L=${leagueId}&JSON=1`;

	try {
		const response = await fetchJSON<MFLFreeAgentsResponse>(url, cookie);
		const players = response.freeAgents?.leagueUnit?.player;
		return players ? toArray(players) : [];
	} catch (error) {
		console.error(`Fetch free agents for league ${leagueId} failed: ${error}`);
		throw error;
	}
}
