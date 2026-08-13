export async function fetchJson<T>(
	url: string,
	signal?: AbortSignal
): Promise<T> {
	const res = await fetch(url, { signal });
	let data: unknown;
	try {
		data = await res.json();
	} catch {
		throw new Error(
			res.ok ? 'Invalid response from server' : `Request failed (${res.status})`
		);
	}
	const error =
		data && typeof (data as Record<string, unknown>)['error'] === 'string'
			? ((data as Record<string, unknown>)['error'] as string)
			: undefined;
	if (!res.ok || error) {
		throw new Error(error ?? `Request failed (${res.status})`);
	}
	return data as T;
}
