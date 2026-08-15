import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	bustActionContextCache,
	bustRosterCache,
	getLeagueFull,
	getMyLeagues,
	getPendingWaivers,
	parseAddsDrops,
	submitImport,
	MFL_COOKIE_NAME
} from '$lib/mfl';
import type { ActionRequest } from '$lib/types';

interface WaiverClaim {
	playerId: string;
	bid: string;
	dropPlayerId?: string;
	round: string;
}

function formatClaim(claim: WaiverClaim): string {
	return `${claim.playerId}_${claim.bid}_${claim.dropPlayerId ?? '0000'}`;
}

async function getFranchiseClaims(
	leagueId: string,
	franchiseId: string,
	leagueHost: string,
	cookie: string
): Promise<WaiverClaim[]> {
	const pending = await getPendingWaivers(leagueId, cookie, leagueHost);
	const myRequests = pending.filter(
		(request) => !request.franchise || request.franchise === franchiseId
	);
	return myRequests.flatMap((request) =>
		parseAddsDrops(request.addsDrops).map((claim) => ({
			...claim,
			round: request.round
		}))
	);
}

export const POST: RequestHandler = async ({ cookies, request }) => {
	const cookie = cookies.get(MFL_COOKIE_NAME);
	if (!cookie) {
		return json({ success: false, error: 'Not logged in' }, { status: 401 });
	}

	let body: ActionRequest;
	try {
		body = await request.json();
	} catch {
		return json(
			{ success: false, error: 'Invalid request body' },
			{ status: 400 }
		);
	}

	const { leagueId, action } = body;
	if (!leagueId || !action) {
		return json(
			{ success: false, error: 'Missing required fields' },
			{ status: 400 }
		);
	}

	if (action === 'saveAll') {
		if (
			!Array.isArray(body.claims) ||
			body.claims.some(
				(claim) =>
					!claim.playerId ||
					!Number.isFinite(parseFloat(claim.bid)) ||
					parseFloat(claim.bid) <= 0
			)
		) {
			return json(
				{ success: false, error: 'Enter a valid bid amount' },
				{ status: 400 }
			);
		}
	} else if (!body.playerId || !['bid', 'withdraw'].includes(action)) {
		return json(
			{ success: false, error: 'Missing required fields' },
			{ status: 400 }
		);
	}

	let franchiseId: string | undefined;
	let leagueHost: string | undefined;
	try {
		const myLeagues = await getMyLeagues(cookie);
		const league = myLeagues.find((l) => l.id === leagueId);
		franchiseId = league?.franchiseId;
		leagueHost = league?.baseUrl;
	} catch (error) {
		return json(
			{
				success: false,
				error:
					error instanceof Error ? error.message : 'Failed to resolve league'
			},
			{ status: 502 }
		);
	}

	if (!franchiseId || !leagueHost) {
		return json(
			{ success: false, error: 'League not associated with this account' },
			{ status: 400 }
		);
	}

	try {
		if (action === 'saveAll') {
			const result = await saveAllBids(body, franchiseId, leagueHost, cookie);
			if (result.success) bustActionContextCache();
			return json(result);
		}

		const singleBody = body as Extract<
			ActionRequest,
			{ action: 'bid' | 'withdraw' }
		>;

		if (action === 'withdraw') {
			const result = await withdrawBid(
				singleBody,
				franchiseId,
				leagueHost,
				cookie
			);
			if (result.success) bustActionContextCache();
			return json(result);
		}

		const bid = parseFloat(singleBody.bid ?? '');
		if (!Number.isFinite(bid) || bid <= 0) {
			return json(
				{ success: false, error: 'Enter a valid bid amount' },
				{ status: 400 }
			);
		}

		const leagueFull = await getLeagueFull(leagueId, cookie);
		const isBbid = leagueFull?.currentWaiverType === 'BBID';

		const result = isBbid
			? await upsertBid(
					singleBody,
					franchiseId,
					leagueHost,
					cookie,
					leagueFull?.bbidConditional === true
				)
			: await submitImport(
					leagueHost,
					'fcfsWaiver',
					{
						L: leagueId,
						FRANCHISE_ID: franchiseId,
						ADD: singleBody.playerId,
						...(singleBody.dropPlayerId && singleBody.dropPlayerId !== '0000'
							? { DROP: singleBody.dropPlayerId }
							: {})
					},
					cookie
				);

		if (result.success) {
			bustActionContextCache();
			if (!isBbid) bustRosterCache(leagueId);
			return json({
				success: true,
				message: isBbid ? 'Bid submitted' : 'Player added'
			});
		}
		return json(result);
	} catch (error) {
		return json(
			{
				success: false,
				error:
					error instanceof Error ? error.message : 'Failed to submit action'
			},
			{ status: 502 }
		);
	}
};

async function upsertBid(
	body: Extract<ActionRequest, { action: 'bid' | 'withdraw' }>,
	franchiseId: string,
	leagueHost: string,
	cookie: string,
	conditional: boolean
): Promise<{ success: boolean; message?: string; error?: string }> {
	const claims = await getFranchiseClaims(
		body.leagueId,
		franchiseId,
		leagueHost,
		cookie
	);

	const newClaim: WaiverClaim = {
		playerId: body.playerId,
		bid: body.bid ?? '0',
		dropPlayerId:
			body.dropPlayerId && body.dropPlayerId !== '0000'
				? body.dropPlayerId
				: undefined,
		round: '1'
	};

	if (!conditional) {
		const withoutTarget = claims.filter(
			(claim) => claim.playerId !== body.playerId
		);
		const index = claims.findIndex((claim) => claim.playerId === body.playerId);
		if (index >= 0) {
			withoutTarget.splice(index, 0, newClaim);
		} else {
			withoutTarget.push(newClaim);
		}
		const picks = withoutTarget.map(formatClaim).join(',');
		return submitImport(
			leagueHost,
			'blindBidWaiverRequest',
			{
				L: body.leagueId,
				FRANCHISE_ID: franchiseId,
				PICKS: picks,
				REPLACE: '1'
			},
			cookie
		);
	}

	const byRound = new Map<string, WaiverClaim[]>();
	for (const claim of claims) {
		const list = byRound.get(claim.round) ?? [];
		list.push(claim);
		byRound.set(claim.round, list);
	}

	const existing = claims.find((claim) => claim.playerId === body.playerId);
	const targetRound = existing?.round ?? '1';
	const roundClaims = (byRound.get(targetRound) ?? []).filter(
		(claim) => claim.playerId !== body.playerId
	);
	roundClaims.push(newClaim);
	return submitImport(
		leagueHost,
		'blindBidWaiverRequest',
		{
			L: body.leagueId,
			FRANCHISE_ID: franchiseId,
			ROUND: targetRound,
			PICKS: roundClaims.map(formatClaim).join(','),
			REPLACE: '1'
		},
		cookie
	);
}

async function saveAllBids(
	body: Extract<ActionRequest, { action: 'saveAll' }>,
	franchiseId: string,
	leagueHost: string,
	cookie: string
): Promise<{ success: boolean; message?: string; error?: string }> {
	const claims = await getFranchiseClaims(
		body.leagueId,
		franchiseId,
		leagueHost,
		cookie
	);

	const requested = new Map(
		body.claims.map((claim) => [claim.playerId, claim])
	);

	const final: WaiverClaim[] = [];
	const handled = new Set<string>();
	for (const claim of claims) {
		const req = requested.get(claim.playerId);
		if (!req) continue;
		handled.add(claim.playerId);
		final.push({
			playerId: claim.playerId,
			bid: req.bid,
			dropPlayerId:
				req.dropPlayerId && req.dropPlayerId !== '0000'
					? req.dropPlayerId
					: undefined,
			round: claim.round
		});
	}
	for (const req of body.claims) {
		if (handled.has(req.playerId)) continue;
		final.push({
			playerId: req.playerId,
			bid: req.bid,
			dropPlayerId:
				req.dropPlayerId && req.dropPlayerId !== '0000'
					? req.dropPlayerId
					: undefined,
			round: '1'
		});
	}

	const leagueFull = await getLeagueFull(body.leagueId, cookie);
	const conditional = leagueFull?.bbidConditional === true;

	if (final.length === 0) {
		return submitImport(
			leagueHost,
			'blindBidWaiverRequest',
			{ L: body.leagueId, FRANCHISE_ID: franchiseId, PICKS: '' },
			cookie
		);
	}

	if (!conditional) {
		const picks = final.map(formatClaim).join(',');
		return submitImport(
			leagueHost,
			'blindBidWaiverRequest',
			{
				L: body.leagueId,
				FRANCHISE_ID: franchiseId,
				PICKS: picks,
				REPLACE: '1'
			},
			cookie
		);
	}

	const byRound = new Map<string, WaiverClaim[]>();
	for (const claim of final) {
		const list = byRound.get(claim.round) ?? [];
		list.push(claim);
		byRound.set(claim.round, list);
	}
	for (const [round, list] of byRound) {
		const result = await submitImport(
			leagueHost,
			'blindBidWaiverRequest',
			{
				L: body.leagueId,
				FRANCHISE_ID: franchiseId,
				ROUND: round,
				PICKS: list.map(formatClaim).join(','),
				REPLACE: '1'
			},
			cookie
		);
		if (!result.success) return result;
	}
	return { success: true, message: 'Bids saved' };
}

async function withdrawBid(
	body: Extract<ActionRequest, { action: 'bid' | 'withdraw' }>,
	franchiseId: string,
	leagueHost: string,
	cookie: string
): Promise<{ success: boolean; message?: string; error?: string }> {
	const claims = await getFranchiseClaims(
		body.leagueId,
		franchiseId,
		leagueHost,
		cookie
	);
	const remaining = claims.filter((claim) => claim.playerId !== body.playerId);

	const byRound = new Map<string, WaiverClaim[]>();
	for (const claim of remaining) {
		const list = byRound.get(claim.round) ?? [];
		list.push(claim);
		byRound.set(claim.round, list);
	}

	if (byRound.size === 0) {
		return submitImport(
			leagueHost,
			'blindBidWaiverRequest',
			{ L: body.leagueId, FRANCHISE_ID: franchiseId, PICKS: '' },
			cookie
		);
	}

	const leagueFull = await getLeagueFull(body.leagueId, cookie);
	const conditional = leagueFull?.bbidConditional === true;

	if (!conditional) {
		const picks = [...byRound.values()].flat().map(formatClaim).join(',');
		return submitImport(
			leagueHost,
			'blindBidWaiverRequest',
			{
				L: body.leagueId,
				FRANCHISE_ID: franchiseId,
				PICKS: picks,
				REPLACE: '1'
			},
			cookie
		);
	}

	for (const [round, list] of byRound) {
		const result = await submitImport(
			leagueHost,
			'blindBidWaiverRequest',
			{
				L: body.leagueId,
				FRANCHISE_ID: franchiseId,
				ROUND: round,
				PICKS: list.map(formatClaim).join(','),
				REPLACE: '1'
			},
			cookie
		);
		if (!result.success) return result;
	}
	return { success: true, message: 'Bid withdrawn' };
}
