import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMyLeagues, getTransactions, loadPlayerCache } from '$lib/api';

export const GET: RequestHandler = async ({ cookies, url }) => {
  const cookie = cookies.get('mfl_cookie');
  const type = url.searchParams.get('type');
  const leagueId = url.searchParams.get('league');
  const transType = url.searchParams.get('transType') || undefined;
  const days = url.searchParams.get('days') ? parseInt(url.searchParams.get('days')!) : undefined;

  try {
    switch (type) {
      case 'leagues': {
        const leagues = await getMyLeagues(cookie);
        return json({ leagues });
      }
      
      case 'transactions': {
        if (!leagueId) {
          return json({ error: 'League ID required' }, { status: 400 });
        }
        const transactions = await getTransactions(leagueId, cookie, transType, days);
        return json({ transactions });
      }
      
      case 'players': {
        const players = await loadPlayerCache(cookie);
        return json({ players: Array.from(players.entries()) });
      }
      
      default:
        return json({ error: 'Invalid type parameter' }, { status: 400 });
    }
  } catch (error) {
    console.error('API proxy error:', error);
    return json({ error: 'Failed to fetch from MFL' }, { status: 500 });
  }
};