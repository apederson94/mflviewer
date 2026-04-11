import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMyLeagues, getTransactions, loadPlayerCache, getCurrentWeek, getPlayerName, getLeagueFranchises, getFranchiseName } from '$lib/api';
import type { MFLTransaction } from '$lib/types';

function extractPlayerIds(t: MFLTransaction): string[] {
  const players: string[] = [];
  
  if (t.type === 'FREE_AGENT' && t.transaction) {
    const ids = t.transaction.split(',');
    for (const id of ids) {
      const cleaned = id.replace('|', '').trim();
      if (cleaned.length > 0) {
        players.push(cleaned);
      }
    }
  }
  
  if (t.type === 'TRADE') {
    if (t.franchise1_gave_up) {
      for (const id of t.franchise1_gave_up.split(',')) {
        if (id.trim()) players.push(id.trim());
      }
    }
    if (t.franchise2_gave_up) {
      for (const id of t.franchise2_gave_up.split(',')) {
        if (id.trim()) players.push(id.trim());
      }
    }
  }
  
  return players;
}

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
        const currentWeek = await getCurrentWeek();
        const transactions = await getTransactions(leagueId, cookie, transType, days, currentWeek);
        const players = await loadPlayerCache(cookie);
        const franchises = await getLeagueFranchises(leagueId, cookie);
        const transactionsWithNames = transactions.map(t => {
          const playerIds = extractPlayerIds(t);
          const names = playerIds.map(id => getPlayerName(players, id));
          const franchiseName = getFranchiseName(franchises, t.franchise);
          return {
            ...t,
            playerName: names.length > 0 ? names.join(', ') : undefined,
            franchiseName
          };
        });
        return json({ transactions: transactionsWithNames });
      }
      
      case 'players': {
        const players = await loadPlayerCache(cookie);
        return json({ players: Array.from(players.entries()) });
      }
      
      case 'week': {
        const week = await getCurrentWeek();
        return json({ week });
      }
      
      default:
        return json({ error: 'Invalid type parameter' }, { status: 400 });
    }
  } catch (error) {
    console.error('API proxy error:', error);
    return json({ error: 'Failed to fetch from MFL' }, { status: 500 });
  }
};