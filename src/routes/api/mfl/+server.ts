import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getTransactions,
	getPendingWaivers,
	getFreeAgents,
	getFranchiseRoster,
	loadPlayerCache,
	getCurrentYear,
	getLeagueFull,
	getMyLeagues,
	parseAddsDrops,
	MFL_COOKIE_NAME
} from '$lib/mfl';
import {
	enrichTransactions,
	enrichPendingWaivers,
	enrichFreeAgents
} from '$lib/enrichment';
import { warmPlayerImages } from '$lib/playerImages';
import type {
	Player,
	PlayerData,
	RosterPlayer,
	WaiverManagerClaim,
	WaiverManagerLeague
} from '$lib/types';

function resolvePlayer(
	players: Map<string, PlayerData>,
	id: string
): Player | undefined {
	const data = players.get(id);
	return {
		id,
		name: data?.name ?? `Unknown (${id})`,
		position: data?.position?.toUpperCase(),
		team: data?.team,
		rosterPct: data?.rosterPct
	};
}

export const GET: RequestHandler = async ({ cookies, url }) => {
	const cookie = cookies.get(MFL_COOKIE_NAME);
	const type = url.searchParams.get('type');
	const leagueId = url.searchParams.get('league');
	const daysParam = url.searchParams.get('days');
	const days =
		daysParam === 'all' ? undefined : parseInt(daysParam || '7') || 7;

	try {
		switch (type) {
			case 'transactions': {
				if (!leagueId) {
					return json({ error: 'League ID required' }, { status: 400 });
				}
				const leagueIds = leagueId
					.split(',')
					.map((id) => id.trim())
					.filter(Boolean);
				const currentYear = await getCurrentYear();
				const players = await loadPlayerCache(cookie);
				const includeTrades = url.searchParams.get('includeTrades') === 'true';

				const leagueErrors: string[] = [];
				const leagueResults = await Promise.all(
					leagueIds.map(async (lid) => {
						try {
							const [transactions, league] = await Promise.all([
								getTransactions(lid, cookie, days),
								getLeagueFull(lid, cookie)
							]);
							return {
								leagueId: lid,
								leagueName: league?.name || lid,
								transactions,
								franchiseMap: league?.franchises || new Map<string, string>()
							};
						} catch (e) {
							leagueErrors.push(
								`${lid}: ${e instanceof Error ? e.message : String(e)}`
							);
							console.error(`Failed to fetch data for league ${lid}:`, e);
							return null;
						}
					})
				);

				if (leagueResults.every((r) => r === null)) {
					return json(
						{
							transactions: [],
							error: `MFL request failed: ${leagueErrors.join('; ')}`
						},
						{ status: 502 }
					);
				}

				const enriched = enrichTransactions(
					leagueResults.filter((r): r is NonNullable<typeof r> => r !== null),
					players,
					currentYear,
					includeTrades
				);
				return json({ transactions: enriched });
			}

			case 'pendingWaivers': {
				if (!leagueId) {
					return json({ error: 'League ID required' }, { status: 400 });
				}
				const leagueIds = leagueId
					.split(',')
					.map((id) => id.trim())
					.filter(Boolean);
				const players = await loadPlayerCache(cookie);
				const myLeagues = await getMyLeagues(cookie);

				const waiverErrors: string[] = [];
				const leagueResults = await Promise.all(
					leagueIds.map(async (lid) => {
						try {
							const myLeague = myLeagues.find((league) => league.id === lid);
							const leagueHost = myLeague?.baseUrl;
							const franchiseId = myLeague?.franchiseId;
							const [waivers, league, roster] = await Promise.all([
								getPendingWaivers(lid, cookie, leagueHost),
								getLeagueFull(lid, cookie),
								franchiseId && leagueHost
									? getFranchiseRoster(lid, franchiseId, cookie, leagueHost)
									: Promise.resolve([])
							]);
							return {
								leagueId: lid,
								leagueName: league?.name || lid,
								waivers,
								franchiseMap: league?.franchises || new Map<string, string>(),
								franchiseId: franchiseId ?? '',
								franchiseName: franchiseId
									? league?.franchises.get(franchiseId) ||
										`Franchise ${franchiseId}`
									: '',
								baseUrl: leagueHost ?? '',
								roster: roster.map((p): RosterPlayer => ({
									id: p.id,
									status: p.status || 'ROSTER',
									name: players.get(p.id)?.name,
									position: players.get(p.id)?.position
								})),
								settings: {
									waiverType: league?.currentWaiverType || 'FREE_AGENT',
									seasonLimit: league?.bbidSeasonLimit,
									increment: league?.bbidIncrement,
									minimum: league?.bbidMinimum,
									conditional: league?.bbidConditional
								},
								rosterSize: league?.rosterSize ?? 0,
								starters: league?.starters ?? 0,
								positionLimits: league?.rosterLimits ?? [],
								bbidAvailableBalance: league?.franchiseBbidBalances?.get(
									franchiseId ?? ''
								)
							};
						} catch (e) {
							waiverErrors.push(
								`${lid}: ${e instanceof Error ? e.message : String(e)}`
							);
							console.error(
								`Failed to fetch pending waivers for league ${lid}:`,
								e
							);
							return null;
						}
					})
				);

				if (leagueResults.every((r) => r === null)) {
					return json(
						{
							pendingWaivers: [],
							contexts: [],
							error: `MFL request failed: ${waiverErrors.join('; ')}`
						},
						{ status: 502 }
					);
				}

				const successful = leagueResults.filter(
					(r): r is NonNullable<typeof r> => r !== null
				);
				const enriched = enrichPendingWaivers(successful, players);

				const contexts: WaiverManagerLeague[] = successful
					.filter((r) => r.franchiseId && r.baseUrl)
					.map((r) => {
						const myRequests = r.waivers.filter(
							(request) =>
								!request.franchise || request.franchise === r.franchiseId
						);
						const claims: WaiverManagerClaim[] = myRequests.flatMap((request) =>
							parseAddsDrops(request.addsDrops).map((claim) => ({
								playerId: claim.playerId,
								bid: claim.bid,
								dropPlayerId: claim.dropPlayerId,
								round: request.round,
								addedPlayer: resolvePlayer(players, claim.playerId),
								droppedPlayer: claim.dropPlayerId
									? resolvePlayer(players, claim.dropPlayerId)
									: undefined
							}))
						);
						return {
							leagueId: r.leagueId,
							leagueName: r.leagueName,
							franchiseId: r.franchiseId,
							franchiseName: r.franchiseName,
							baseUrl: r.baseUrl,
							bidSettings: r.settings,
							rosterSize: r.rosterSize,
							starters: r.starters,
							positionLimits: r.positionLimits,
							bbidAvailableBalance: r.bbidAvailableBalance,
							roster: r.roster,
							claims
						} satisfies WaiverManagerLeague;
					});
				return json({ pendingWaivers: enriched, contexts });
			}

			case 'freeAgents': {
				if (!leagueId) {
					return json({ error: 'League ID required' }, { status: 400 });
				}
				const leagueIds = leagueId
					.split(',')
					.map((id) => id.trim())
					.filter(Boolean);
				const players = await loadPlayerCache(cookie);

				const faErrors: string[] = [];
				const leagueResults = await Promise.all(
					leagueIds.map(async (lid) => {
						try {
							const freeAgents = await getFreeAgents(lid, cookie);
							return { leagueId: lid, freeAgents };
						} catch (e) {
							faErrors.push(
								`${lid}: ${e instanceof Error ? e.message : String(e)}`
							);
							console.error(
								`Failed to fetch free agents for league ${lid}:`,
								e
							);
							return null;
						}
					})
				);

				if (leagueResults.every((r) => r === null)) {
					return json(
						{
							freeAgents: [],
							error: `MFL request failed: ${faErrors.join('; ')}`
						},
						{ status: 502 }
					);
				}

				const freeAgents = enrichFreeAgents(
					leagueResults.filter((r): r is NonNullable<typeof r> => r !== null),
					players
				);

				warmPlayerImages(
					freeAgents.map((fa) => fa.id),
					6
				).catch((err) => console.error('Free agent image warm failed:', err));

				return json({ freeAgents });
			}

			default:
				return json({ error: 'Invalid type parameter' }, { status: 400 });
		}
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'An unexpected error occurred';
		console.error('API proxy error:', message);
		return json({ error: message }, { status: 500 });
	}
};
