import { fetchJSON, getBaseUrl, loadPlayerCache } from './mfl';
import type { MFLPlayerProfile } from './types';

const profileCache = new Map<string, MFLPlayerProfile>();
const missingPlayers = new Set<string>();
const inflight = new Map<string, Promise<MFLPlayerProfile | null>>();

let cacheDate = '';

export function isRealPlayerId(id: string): boolean {
	return /^\d+$/.test(id);
}

function isProfileCacheValid(): boolean {
	return cacheDate === new Date().toDateString();
}

function resetProfileCacheIfStale(): void {
	if (!isProfileCacheValid()) {
		profileCache.clear();
		missingPlayers.clear();
		inflight.clear();
		cacheDate = new Date().toDateString();
	}
}

async function fetchProfile(id: string): Promise<MFLPlayerProfile | null> {
	const base = await getBaseUrl();
	const response = await fetchJSON<{ playerProfile?: MFLPlayerProfile }>(
		`${base}?TYPE=playerProfile&P=${encodeURIComponent(id)}&JSON=1`
	);
	if (!response.playerProfile?.player?.id) {
		missingPlayers.add(id);
		return null;
	}

	const profile = response.playerProfile;
	const adp = (await loadPlayerCache()).get(id)?.adp;
	if (adp) {
		profile.player.adp = adp;
	}

	profileCache.set(id, profile);
	return profile;
}

export async function getPlayerProfile(
	id: string
): Promise<MFLPlayerProfile | null> {
	resetProfileCacheIfStale();

	const cached = profileCache.get(id);
	if (cached) return cached;
	if (missingPlayers.has(id)) return null;

	const existing = inflight.get(id);
	if (existing) return existing;

	const promise = fetchProfile(id).finally(() => {
		inflight.delete(id);
	});
	inflight.set(id, promise);
	return promise;
}
