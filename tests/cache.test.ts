import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTtlCache, msUntilNextCalendarDay } from '../src/lib/cache';

describe('createTtlCache', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-08-12T12:00:00'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('stores and returns values before expiry', () => {
		const cache = createTtlCache<string>(5000);
		cache.set('a', 'value');
		expect(cache.get('a')).toBe('value');
	});

	it('returns undefined for missing keys', () => {
		const cache = createTtlCache<string>(5000);
		expect(cache.get('missing')).toBeUndefined();
	});

	it('honors the default TTL', () => {
		const cache = createTtlCache<string>(1000);
		cache.set('a', 'value');
		vi.advanceTimersByTime(999);
		expect(cache.get('a')).toBe('value');
		vi.advanceTimersByTime(1);
		expect(cache.get('a')).toBeUndefined();
	});

	it('honors a per-set TTL override', () => {
		const cache = createTtlCache<string>(5000);
		cache.set('a', 'value', 1000);
		vi.advanceTimersByTime(1001);
		expect(cache.get('a')).toBeUndefined();
	});

	it('expired entries are dropped and can be re-set', () => {
		const cache = createTtlCache<string>(1000);
		cache.set('a', 'first');
		vi.advanceTimersByTime(1001);
		expect(cache.get('a')).toBeUndefined();
		cache.set('a', 'second');
		expect(cache.get('a')).toBe('second');
	});

	it('clear removes all entries', () => {
		const cache = createTtlCache<string>(5000);
		cache.set('a', 'value');
		cache.set('b', 'value');
		cache.clear();
		expect(cache.get('a')).toBeUndefined();
		expect(cache.get('b')).toBeUndefined();
	});
});

describe('msUntilNextCalendarDay', () => {
	it('returns ms until end of the given day', () => {
		const now = new Date('2026-08-12T12:00:00.000');
		expect(msUntilNextCalendarDay(now)).toBe(43199999);
	});

	it('returns 0 exactly at end of day', () => {
		const now = new Date('2026-08-12T23:59:59.999');
		expect(msUntilNextCalendarDay(now)).toBe(0);
	});

	it('defaults to the current time and is always non-negative', () => {
		expect(msUntilNextCalendarDay()).toBeGreaterThanOrEqual(0);
	});
});
