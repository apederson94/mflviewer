interface CacheEntry<T> {
	value: T;
	expiresAt: number;
}

export interface TtlCache<T> {
	get(key: string): T | undefined;
	set(key: string, value: T, ttlMs?: number): void;
	clear(): void;
}

export function createTtlCache<T>(defaultTtlMs: number): TtlCache<T> {
	const store = new Map<string, CacheEntry<T>>();

	function get(key: string): T | undefined {
		const entry = store.get(key);
		if (!entry) return undefined;
		if (Date.now() >= entry.expiresAt) {
			store.delete(key);
			return undefined;
		}
		return entry.value;
	}

	function set(key: string, value: T, ttlMs = defaultTtlMs): void {
		store.set(key, { value, expiresAt: Date.now() + ttlMs });
	}

	function clear(): void {
		store.clear();
	}

	return { get, set, clear };
}

export function msUntilNextCalendarDay(now = new Date()): number {
	const endOfDay = new Date(now);
	endOfDay.setHours(23, 59, 59, 999);
	return Math.max(0, endOfDay.getTime() - now.getTime());
}
