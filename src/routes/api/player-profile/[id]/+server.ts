import type { RequestHandler } from './$types';
import { getPlayerProfile, isRealPlayerId } from '$lib/playerProfiles';

export const config = {
	maxDuration: 60
};

export const GET: RequestHandler = async ({ params }) => {
	if (!isRealPlayerId(params.id)) {
		return new Response(JSON.stringify({ error: 'Invalid player id' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		const profile = await getPlayerProfile(params.id);

		if (!profile) {
			return new Response(
				JSON.stringify({ error: 'Player profile not found' }),
				{
					status: 404,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		return new Response(JSON.stringify(profile), {
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'public, max-age=3600'
			}
		});
	} catch (err) {
		return new Response(
			JSON.stringify({
				error:
					err instanceof Error ? err.message : 'Failed to load player profile'
			}),
			{
				status: 502,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
