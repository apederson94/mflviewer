import type { RequestHandler } from './$types';
import { getPlayerImage } from '$lib/playerImages';

export const config = {
	maxDuration: 60
};

export const GET: RequestHandler = async ({ params }) => {
	const image = await getPlayerImage(params.id);

	if (!image) {
		return new Response('Not found', { status: 404 });
	}

	return new Response(image, {
		headers: {
			'Content-Type': 'image/jpeg',
			'Cache-Control': 'public, max-age=86400, immutable'
		}
	});
};
