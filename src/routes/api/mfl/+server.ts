import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getTransactions,
	getPendingWaivers,
	getFreeAgents,
	loadPlayerCache,
	getCurrentYear,
	getLeagueFull,
	MFL_COOKIE_NAME
} from '$lib/mfl';
import {
	enrichTransactions,
	enrichPendingWaivers,
	enrichFreeAgents
} from '$lib/enrichment';
import { warmPlayerImages } from '$lib/playerImages';

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

				const waiverErrors: string[] = [];
				const leagueResults = await Promise.all(
					leagueIds.map(async (lid) => {
						try {
							const [waivers, league] = await Promise.all([
								getPendingWaivers(lid, cookie),
								getLeagueFull(lid, cookie)
							]);
							return {
								leagueId: lid,
								leagueName: league?.name || lid,
								waivers,
								franchiseMap: league?.franchises || new Map<string, string>()
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
							error: `MFL request failed: ${waiverErrors.join('; ')}`
						},
						{ status: 502 }
					);
				}

				const enriched = enrichPendingWaivers(
					leagueResults.filter((r): r is NonNullable<typeof r> => r !== null),
					players
				);
				return json({ pendingWaivers: enriched });
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
