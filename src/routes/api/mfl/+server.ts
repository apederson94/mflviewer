import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMyLeagues, getTransactions, loadPlayerCache, getCurrentWeek, getCurrentYear, getPlayerName, getLeagueFull, getFranchiseName, formatDraftPick, formatTimestamp, MFL_COOKIE_NAME } from '$lib/api';
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
  const cookie = cookies.get(MFL_COOKIE_NAME);
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
        const currentYear = await getCurrentYear();
        const transactions = await getTransactions(leagueId, cookie, transType, days, currentWeek);
        const players = await loadPlayerCache(cookie);
        const league = await getLeagueFull(leagueId, cookie);
        const franchiseMap = league?.franchises || new Map<string, string>();
        const transactionsWithNames = transactions.map(t => {
          const franchiseName = getFranchiseName(franchiseMap, t.franchise);
          
          if (t.type === 'TRADE') {
            const f1Gave = t.franchise1_gave_up?.split(',').filter(Boolean) || [];
            const f2Gave = t.franchise2_gave_up?.split(',').filter(Boolean) || [];
            
            const f1Names = f1Gave.map(id => {
              if (id.startsWith('FP_') || id.startsWith('DP_')) return formatDraftPick(id.trim(), currentYear);
              return getPlayerName(players, id.trim());
            });
            const f2Names = f2Gave.map(id => {
              if (id.startsWith('FP_') || id.startsWith('DP_')) return formatDraftPick(id.trim(), currentYear);
              return getPlayerName(players, id.trim());
            });

            const tradePartnerId = t.franchise === t.franchise ? t.franchise2 : t.franchise;
            const tradePartnerName = getFranchiseName(franchiseMap, tradePartnerId || t.franchise2 || '');
            const formattedTime = t.timestamp ? formatTimestamp(t.timestamp) : '';

            return {
              ...t,
              playerNames: [...f1Names, ...f2Names],
              playerName: [...f1Names, ...f2Names].join(', '),
              franchiseName,
              tradePartnerName: t.franchise2 ? getFranchiseName(franchiseMap, t.franchise2) : undefined,
              tradeGives: f1Names,
              tradeReceives: f2Names,
              formattedTime
            };
          }
          
          // FREE_AGENT or other
          const playerIds = extractPlayerIds(t);
          const names = playerIds.map(id => getPlayerName(players, id));
          const formattedTime = t.timestamp ? formatTimestamp(t.timestamp) : '';
          return {
            ...t,
            playerNames: names,
            playerName: names.length > 0 ? names.join(', ') : undefined,
            franchiseName,
            formattedTime
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
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    console.error('API proxy error:', message);
    return json({ error: message }, { status: 500 });
  }
};