import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getActionContext, loadPlayerCache, MFL_COOKIE_NAME } from '$lib/mfl';
import type { PlayerActionLeague } from '$lib/types';

export const GET: RequestHandler = async ({ cookies, url }) => {
	const cookie = cookies.get(MFL_COOKIE_NAME);
	if (!cookie) {
		return json({ error: 'Not logged in' }, { status: 401 });
	}

	const leagueParam = url.searchParams.get('league');
	const playerId = url.searchParams.get('player');
	if (!leagueParam || !playerId) {
		return json(
			{ error: 'league and player parameters are required' },
			{ status: 400 }
		);
	}

	const leagueIds = leagueParam
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean);

	try {
		const players = await loadPlayerCache(cookie);
		const results = await Promise.all(
			leagueIds.map((lid) => getActionContext(lid, playerId, players, cookie))
		);

		const leagues = results.filter(
			(r): r is NonNullable<typeof r> => r !== null
		);
		if (leagues.length === 0) {
			return json({ error: 'Failed to load action context' }, { status: 502 });
		}
		const response: { leagues: PlayerActionLeague[] } = { leagues };
		return json(response);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'An unexpected error occurred';
		console.error('Player actions API error:', message);
		return json({ error: message }, { status: 500 });
	}
};
