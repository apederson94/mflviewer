import type {
	MFLTransactionsResponse,
	MFLTransaction,
	MFLMyLeaguesResponse,
	MFLPlayersResponse,
	MFLTopOwnsResponse,
	MFLTopOwnsPlayer,
	MFLPendingWaiversResponse,
	MFLPendingWaiverRequest,
	MFLFreeAgentsResponse,
	MFLFreeAgentRaw,
	League,
	MFLLeagueResponse,
	MFLAdpResponse,
	MFLRostersResponse,
	MFLPlayerRosterStatusResponse,
	MFLRosterPlayer,
	PlayerData,
	PlayerActionLeague,
	ExistingBid,
	PositionLimit,
	RosterPlayer
} from './types';
import { createTtlCache, msUntilNextCalendarDay } from './cache';
import { resetImageCacheIfStale } from './playerImages';

export const MFL_COOKIE_NAME = 'mfl_cookie';

function toArray<T>(item: T | T[]): T[] {
	return Array.isArray(item) ? item : [item];
}

const LEAGUE_CACHE_TTL_MS = 60 * 60 * 1000;

const yearWeekCache = createTtlCache<{ year: string; week: number }>(
	msUntilNextCalendarDay()
);
let yearWeekPromise: Promise<{ year: string; week: number }> | null = null;
const leagueFullCache = createTtlCache<LeagueFull>(LEAGUE_CACHE_TTL_MS);
const playerCache = createTtlCache<Map<string, PlayerData>>(
	msUntilNextCalendarDay()
);

let topOwnsCache: MFLTopOwnsPlayer[] | null = null;
let topOwnsCacheDate = '';

async function getTopOwns(cookie?: string): Promise<MFLTopOwnsPlayer[]> {
	const today = new Date().toDateString();
	if (topOwnsCache && topOwnsCacheDate === today) return topOwnsCache;
	const baseUrl = await getBaseUrl();
	const ownsUrl = `${baseUrl}?TYPE=topOwns&JSON=1&COUNT=10000`;
	const response = await fetchJSON<MFLTopOwnsResponse>(ownsUrl, cookie);
	const owns = response.topOwns?.player ? toArray(response.topOwns.player) : [];
	topOwnsCache = owns;
	topOwnsCacheDate = today;
	return owns;
}

export async function getYearAndWeek(): Promise<{
	year: string;
	week: number;
}> {
	const cached = yearWeekCache.get('current');
	if (cached) {
		return { year: cached.year, week: cached.week };
	}
	if (yearWeekPromise) {
		return yearWeekPromise;
	}
	// MFL's status endpoint is season-scoped (fflnetdynamic{year}); this URL
	// must be updated when MFL rolls over to a new season.
	yearWeekPromise = (async () => {
		const url =
			'https://api.myfantasyleague.com/fflnetdynamic2026/mfl_status.json';
		const response = await fetchJSON<{
			mfl_status: { year: string; weeks: { CurrentWeek: string } };
		}>(url);
		const value = {
			year: response.mfl_status.year,
			week: parseInt(response.mfl_status.weeks.CurrentWeek || '1', 10)
		};
		yearWeekCache.set('current', value, msUntilNextCalendarDay());
		return value;
	})();
	try {
		return await yearWeekPromise;
	} finally {
		yearWeekPromise = null;
	}
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

// MFL's api. edge rate-limits bursts per IP (429). Serialize export calls so
// parallel fan-outs never exceed a few in-flight requests at a time.
const MAX_CONCURRENT_FETCHES = 2;
const fetchQueue: (() => void)[] = [];
let activeFetches = 0;

async function acquireFetchSlot(): Promise<void> {
	if (activeFetches < MAX_CONCURRENT_FETCHES) {
		activeFetches++;
		return;
	}
	await new Promise<void>((resolve) => fetchQueue.push(resolve));
}

function releaseFetchSlot(): void {
	activeFetches--;
	const next = fetchQueue.shift();
	if (next) {
		activeFetches++;
		next();
	}
}

export async function fetchJSON<T>(
	url: string,
	cookie?: string,
	retries = 2
): Promise<T> {
	await acquireFetchSlot();
	try {
		return await fetchJSONInner(url, cookie, retries);
	} finally {
		releaseFetchSlot();
	}
}

async function fetchJSONInner<T>(
	url: string,
	cookie?: string,
	retries = 2
): Promise<T> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		'User-Agent':
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
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

function leagueHostBase(url: string): string | undefined {
	const match = url.match(/^(https?:\/\/[^/]+\/\d{4})/);
	return match ? match[1] : undefined;
}

const myLeaguesCache = createTtlCache<League[]>(60 * 60 * 1000);

export async function getMyLeagues(cookie?: string): Promise<League[]> {
	const cacheKey = cookie || 'anon';
	const cached = myLeaguesCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	const baseUrl = await getBaseUrl();
	const url = `${baseUrl}?TYPE=myleagues&JSON=1`;

	try {
		const response = await fetchJSON<MFLMyLeaguesResponse>(url, cookie);
		const leagues = response.leagues?.league
			? toArray(response.leagues.league)
			: [];

		const result: League[] = leagues.map((league) => ({
			id: league.league_id,
			name: league.name,
			franchiseId: league.franchise_id,
			baseUrl: league.url ? leagueHostBase(league.url) : undefined
		}));
		myLeaguesCache.set(cacheKey, result);
		return result;
	} catch (error) {
		console.error(`Fetch leagues failed: ${error}`);
		throw error;
	}
}

export interface LeagueFull {
	id: string;
	name: string;
	franchises: Map<string, string>;
	currentWaiverType?: string;
	bbidSeasonLimit?: number;
	bbidIncrement?: number;
	bbidMinimum?: number;
	bbidConditional?: boolean;
	rosterSize?: number;
	starters?: number;
	rosterLimits?: PositionLimit[];
	franchiseBbidBalances?: Map<string, number>;
}

export function parsePositionLimits(rosterLimits?: string): PositionLimit[] {
	if (!rosterLimits) return [];
	return rosterLimits
		.split(',')
		.map((pair) => {
			const [position, range] = pair.split(':');
			const [minStr, maxStr] = (range || '0-0').split('-');
			const parse = (value: string | undefined): number => {
				const trimmed = (value ?? '0').trim();
				if (!trimmed || trimmed === '0') return 0;
				const num = parseInt(trimmed, 10);
				return Number.isFinite(num) ? num : 0;
			};
			return {
				position: (position || '').trim().toUpperCase(),
				min: parse(minStr),
				max: parse(maxStr)
			};
		})
		.filter((limit) => limit.position);
}

export async function getLeagueFull(
	leagueId: string,
	cookie?: string
): Promise<LeagueFull | null> {
	const cached = leagueFullCache.get(leagueId);
	if (cached) {
		return cached;
	}

	const baseUrl = await getBaseUrl();
	const url = `${baseUrl}?TYPE=league&L=${encodeURIComponent(leagueId)}&JSON=1`;

	const franchiseMap = new Map<string, string>();
	const bbidBalances = new Map<string, number>();

	try {
		const response = await fetchJSON<MFLLeagueResponse>(url, cookie);

		const leagueIdVal = response.league?.id || leagueId;
		const leagueName = response.league?.name || 'Unknown League';

		if (response.league?.franchises?.franchise) {
			const franchises = toArray(response.league.franchises.franchise);
			franchises.forEach((franchise) => {
				franchiseMap.set(franchise.id, franchise.name);
				if (franchise.bbidAvailableBalance) {
					const balance = parseFloat(franchise.bbidAvailableBalance);
					if (Number.isFinite(balance)) {
						bbidBalances.set(franchise.id, balance);
					}
				}
			});
		}

		const startersRaw = response.league?.starters?.count;
		const league: LeagueFull = {
			id: leagueIdVal,
			name: leagueName,
			franchises: franchiseMap,
			currentWaiverType: response.league?.currentWaiverType,
			bbidSeasonLimit: response.league?.bbidSeasonLimit
				? parseInt(response.league.bbidSeasonLimit, 10)
				: undefined,
			bbidIncrement: response.league?.bbidIncrement
				? parseFloat(response.league.bbidIncrement)
				: undefined,
			bbidMinimum: response.league?.bbidMinimum
				? parseFloat(response.league.bbidMinimum)
				: undefined,
			bbidConditional: response.league?.bbidConditional === 'Yes',
			rosterSize: response.league?.rosterSize
				? parseInt(response.league.rosterSize, 10)
				: undefined,
			starters: startersRaw ? parseInt(startersRaw, 10) : undefined,
			rosterLimits: parsePositionLimits(response.league?.rosterLimits),
			franchiseBbidBalances: bbidBalances
		};

		leagueFullCache.set(leagueId, league);

		return league;
	} catch (error) {
		console.error(`Fetch full league ${leagueId} failed: ${error}`);
		console.warn(
			`League ${leagueId} franchise data unavailable, transactions will show fallback names`
		);
		return null;
	}
}

let playerCachePromise: Promise<Map<string, PlayerData>> | null = null;

export async function loadPlayerCache(
	cookie?: string
): Promise<Map<string, PlayerData>> {
	const cached = playerCache.get('current');
	if (cached) {
		return cached;
	}

	if (playerCachePromise) {
		return playerCachePromise;
	}

	playerCachePromise = (async () => {
		const baseUrl = await getBaseUrl();
		const playersUrl = `${baseUrl}?TYPE=players&JSON=1`;
		const adpUrl = `${baseUrl}?TYPE=adp&JSON=1`;
		const playerCacheMap = new Map<string, PlayerData>();

		const [playerRes, ownsRes, adpRes] = await Promise.allSettled([
			fetchJSON<MFLPlayersResponse>(playersUrl, cookie),
			getTopOwns(cookie),
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

		if (ownsRes.status === 'fulfilled') {
			ownsRes.value.forEach(({ id, percent }) => {
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

		playerCache.set('current', playerCacheMap);

		resetImageCacheIfStale();

		return playerCacheMap;
	})().finally(() => {
		playerCachePromise = null;
	});

	return playerCachePromise;
}

export async function getTopRosteredPlayerIds(count = 1000): Promise<string[]> {
	try {
		const owns = await getTopOwns();
		return owns.slice(0, count).map((p) => p.id);
	} catch (error) {
		console.error(`Fetch top owns failed: ${error}`);
		return [];
	}
}

export async function getTransactions(
	leagueId: string,
	cookie?: string,
	days?: number
): Promise<MFLTransaction[]> {
	const baseUrl = await getBaseUrl();
	const base = `TYPE=transactions&L=${encodeURIComponent(leagueId)}&JSON=1`;

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
	cookie?: string,
	leagueHost?: string
): Promise<MFLPendingWaiverRequest[]> {
	const base = leagueHost ? `${leagueHost}/export` : await getBaseUrl();
	const url = `${base}?TYPE=pendingWaivers&L=${encodeURIComponent(leagueId)}&JSON=1`;

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
	const url = `${baseUrl}?TYPE=freeAgents&L=${encodeURIComponent(leagueId)}&JSON=1`;

	try {
		const response = await fetchJSON<MFLFreeAgentsResponse>(url, cookie);
		const players = response.freeAgents?.leagueUnit?.player;
		return players ? toArray(players) : [];
	} catch (error) {
		console.error(`Fetch free agents for league ${leagueId} failed: ${error}`);
		throw error;
	}
}

export function parseAddsDrops(
	addsDrops: string
): { playerId: string; bid: string; dropPlayerId?: string }[] {
	return addsDrops
		.split(',')
		.map((claim) => {
			const parts = claim.split('_');
			const playerId = parts[0] || '';
			const bid = parts[1] || '0';
			const drop = parts[2];
			const dropPlayerId = drop && drop !== '0000' ? drop : undefined;
			return { playerId, bid, dropPlayerId };
		})
		.filter((claim) => claim.playerId);
}

export async function getFranchiseRoster(
	leagueId: string,
	franchiseId: string,
	cookie?: string,
	leagueHost?: string
): Promise<MFLRosterPlayer[]> {
	const key = `${leagueHost ?? ''}:${leagueId}:${franchiseId}`;
	const cached = franchiseRosterCache.get(key);
	if (cached) {
		return cached;
	}
	if (franchiseRosterPromises.has(key)) {
		return franchiseRosterPromises.get(key)!;
	}

	const promise = (async () => {
		const base = leagueHost ? `${leagueHost}/export` : await getBaseUrl();
		const url = `${base}?TYPE=rosters&L=${encodeURIComponent(
			leagueId
		)}&JSON=1&FRANCHISE=${encodeURIComponent(franchiseId)}`;

		try {
			const response = await fetchJSON<MFLRostersResponse>(url, cookie);
			const franchises = response.rosters?.franchise
				? toArray(response.rosters.franchise)
				: [];
			const roster =
				franchises.find((franchise) => franchise.id === franchiseId) ||
				franchises[0];
			const players = roster?.player ? toArray(roster.player) : [];
			franchiseRosterCache.set(key, players, msUntilNextCalendarDay());
			return players;
		} catch (error) {
			console.error(`Fetch roster for league ${leagueId} failed: ${error}`);
			throw error;
		} finally {
			franchiseRosterPromises.delete(key);
		}
	})();

	franchiseRosterPromises.set(key, promise);
	return promise;
}

export async function getPlayerRosterStatus(
	leagueId: string,
	playerId: string,
	cookie?: string
): Promise<{
	status: 'freeAgent' | 'rostered' | 'locked' | 'unknown';
	rosteredOn?: string;
}> {
	const baseUrl = await getBaseUrl();
	const url = `${baseUrl}?TYPE=playerRosterStatus&L=${encodeURIComponent(
		leagueId
	)}&JSON=1&P=${encodeURIComponent(playerId)}`;

	try {
		const response = await fetchJSON<MFLPlayerRosterStatusResponse>(
			url,
			cookie
		);
		const status = response.playerRosterStatuses?.playerStatus;
		if (status?.roster_franchise?.franchise_id) {
			return {
				status: 'rostered',
				rosteredOn: status.roster_franchise.franchise_id
			};
		}
		if (status?.is_fa === '1') {
			return { status: status.locked === '1' ? 'locked' : 'freeAgent' };
		}
		return { status: 'unknown' };
	} catch (error) {
		console.error(
			`Fetch player roster status for league ${leagueId} failed: ${error}`
		);
		throw error;
	}
}

async function findExistingBid(
	leagueId: string,
	playerId: string,
	franchiseId: string,
	leagueHost: string,
	cookie?: string
): Promise<ExistingBid | null> {
	const pending = await getPendingWaivers(leagueId, cookie, leagueHost);
	const myRequests = pending.filter(
		(request) => !request.franchise || request.franchise === franchiseId
	);
	for (const request of myRequests) {
		const claim = parseAddsDrops(request.addsDrops).find(
			(c) => c.playerId === playerId
		);
		if (claim) {
			return {
				playerId,
				bid: claim.bid,
				dropPlayerId: claim.dropPlayerId,
				round: request.round
			};
		}
	}
	return null;
}

const actionContextCache = createTtlCache<PlayerActionLeague>(60 * 1000);

export function bustActionContextCache(): void {
	actionContextCache.clear();
}

const franchiseRosterCache = createTtlCache<MFLRosterPlayer[]>(
	msUntilNextCalendarDay()
);
const franchiseRosterPromises = new Map<string, Promise<MFLRosterPlayer[]>>();

export function bustRosterCache(leagueId?: string): void {
	for (const key of franchiseRosterCache.keys()) {
		if (leagueId && !key.includes(`:${leagueId}:`)) continue;
		franchiseRosterCache.delete(key);
		franchiseRosterPromises.delete(key);
	}
}

export async function getActionContext(
	leagueId: string,
	playerId: string,
	players: Map<string, PlayerData>,
	cookie?: string
): Promise<PlayerActionLeague | null> {
	const cacheKey = `${leagueId}:${playerId}`;
	const cached = actionContextCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	try {
		const [league, myLeagues] = await Promise.all([
			getLeagueFull(leagueId, cookie),
			getMyLeagues(cookie)
		]);
		if (!league) return null;

		const myLeague = myLeagues.find((l) => l.id === leagueId);
		const franchiseId = myLeague?.franchiseId;
		const leagueHost = myLeague?.baseUrl;
		if (!franchiseId || !leagueHost) return null;

		const [roster, status, existingBid] = await Promise.all([
			getFranchiseRoster(leagueId, franchiseId, cookie, leagueHost),
			getPlayerRosterStatus(leagueId, playerId, cookie),
			findExistingBid(leagueId, playerId, franchiseId, leagueHost, cookie)
		]);

		const rosterPlayers: RosterPlayer[] = roster.map((p) => ({
			id: p.id,
			status: p.status || 'ROSTER',
			name: players.get(p.id)?.name,
			position: players.get(p.id)?.position
		}));

		const result: PlayerActionLeague = {
			leagueId,
			leagueName: league.name,
			franchiseId,
			franchiseName:
				league.franchises.get(franchiseId) || `Franchise ${franchiseId}`,
			baseUrl: leagueHost,
			bidSettings: {
				waiverType: league.currentWaiverType || 'FREE_AGENT',
				seasonLimit: league.bbidSeasonLimit,
				increment: league.bbidIncrement,
				minimum: league.bbidMinimum,
				conditional: league.bbidConditional
			},
			rosterSize: league.rosterSize ?? 0,
			starters: league.starters ?? 0,
			positionLimits: league.rosterLimits ?? [],
			bbidAvailableBalance: league.franchiseBbidBalances?.get(franchiseId),
			playerStatus: status.status,
			rosteredOn: status.rosteredOn,
			onMyRoster: status.rosteredOn === franchiseId,
			roster: rosterPlayers,
			existingBid
		};

		actionContextCache.set(cacheKey, result);
		return result;
	} catch (error) {
		console.error(
			`Failed to build action context for league ${leagueId}: ${error}`
		);
		return null;
	}
}

export async function submitImport(
	leagueHost: string,
	type: string,
	params: Record<string, string>,
	cookie: string
): Promise<{ success: boolean; message?: string; error?: string }> {
	const body = new URLSearchParams({ TYPE: type, XML: '1', ...params });
	const url = `${leagueHost}/import`;

	let response: Response;
	try {
		response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Cookie: cookie,
				'User-Agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
			},
			body: body.toString()
		});
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Import request failed'
		};
	}

	const text = await response.text();
	const errorMatch = text.match(/<error[^>]*>([\s\S]*?)<\/error>/i);
	if (errorMatch) {
		return {
			success: false,
			error: (errorMatch[1] ?? '').trim() || 'MFL rejected the request'
		};
	}
	if (!response.ok) {
		return {
			success: false,
			error: `MFL returned HTTP ${response.status}`
		};
	}
	if (!/<status/i.test(text)) {
		return {
			success: false,
			error: 'Unexpected response from MFL'
		};
	}
	return { success: true };
}
