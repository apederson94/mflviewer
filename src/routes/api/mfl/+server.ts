import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMyLeagues, getTransactions, loadPlayerCache, getCurrentWeek, getCurrentYear, getPlayerName, getPlayerPosition, getLeagueFull, getFranchiseName, formatDraftPick, formatTimestamp, MFL_COOKIE_NAME } from '$lib/api';
import type { MFLTransaction } from '$lib/types';

function getTransactionDisplayName(type: string): string {
  switch (type) {
    case 'FREE_AGENT': return 'Add/Drop';
    case 'TRADE': return 'Trade';
    case 'WAIVER': return 'Waiver';
    default: return type;
  }
}

function parseFreeAgentTransaction(transaction: string): { added: string[]; dropped: string[] } {
  const parts = transaction.split('|');
  const added = parts[0]?.split(',').map(id => id.trim()).filter(Boolean) || [];
  const dropped = parts[1]?.split(',').map(id => id.trim()).filter(Boolean) || [];
  return { added, dropped };
}

export const GET: RequestHandler = async ({ cookies, url }) => {
  const cookie = cookies.get(MFL_COOKIE_NAME);
  const type = url.searchParams.get('type');
  const leagueId = url.searchParams.get('league');
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
        const transactions = await getTransactions(leagueId, cookie, days, currentWeek);
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
              type: getTransactionDisplayName(t.type),
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
          const { added, dropped } = t.transaction 
            ? parseFreeAgentTransaction(t.transaction)
            : { added: [] as string[], dropped: [] as string[] };
          
          const addedPlayers = added.map(id => ({
            id,
            name: getPlayerName(players, id),
            position: getPlayerPosition(players, id)?.toUpperCase()
          }));
          const droppedPlayers = dropped.map(id => ({
            id,
            name: getPlayerName(players, id),
            position: getPlayerPosition(players, id)?.toUpperCase()
          }));
          
          const formattedTime = t.timestamp ? formatTimestamp(t.timestamp) : '';
          return {
            ...t,
            type: getTransactionDisplayName(t.type),
            addedPlayers,
            droppedPlayers,
            playerNames: [...addedPlayers.map(p => p.name), ...droppedPlayers.map(p => p.name)],
            playerName: [...addedPlayers.map(p => p.name), ...droppedPlayers.map(p => p.name)].join(', ') || undefined,
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