import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMyLeagues, getTransactions, getPendingWaivers, getFreeAgents, loadPlayerCache, getCurrentWeek, getCurrentYear, getPlayerName, getPlayerPosition, getLeagueFull, getFranchiseName, formatDraftPick, formatFaab, formatTimestamp, MFL_COOKIE_NAME } from '$lib/api';
import type { MFLTransaction, MFLPendingWaiver, MFLFreeAgent, ParsedWaiverClaim, PlayerData } from '$lib/types';
import { warmPlayerImages } from '$lib/playerImages';

function getTransactionDisplayName(type: string): string {
  switch (type) {
    case 'FREE_AGENT': return 'Add/Drop';
    case 'TRADE': return 'Trade';
    case 'WAIVER': return 'Waiver';
    case 'BBID_WAIVER': return 'Waiver';
    default: return type;
  }
}

function parseFreeAgentTransaction(transaction: string): { added: string[]; dropped: string[] } {
  const parts = transaction.split('|');
  const added = parts[0]?.split(',').map(id => id.trim()).filter(Boolean) || [];
  const dropped = parts[1]?.split(',').map(id => id.trim()).filter(Boolean) || [];
  return { added, dropped };
}

function parseBBIDWaiverTransaction(transaction: string): { added: string[]; dropped: string[]; bid: string } {
  const parts = transaction.split('|');
  const added = parts[0]?.split(',').map(id => id.trim()).filter(Boolean) || [];
  const bid = parts[1]?.trim() || '';
  const dropped = parts[2]?.split(',').map(id => id.trim()).filter(Boolean) || [];
  return { added, dropped, bid };
}

function resolveTradeItem(id: string, players: Map<string, PlayerData>, currentYear: string): { id: string; name: string; position: string; team?: string; rosterPct?: number } {
  const cleanId = id.trim();
  if (cleanId.startsWith('BB_')) {
    return { id: cleanId, name: formatFaab(cleanId), position: 'FAAB' };
  }
  if (cleanId.startsWith('FP_') || cleanId.startsWith('DP_')) {
    return { id: cleanId, name: formatDraftPick(cleanId, currentYear), position: 'PICK' };
  }
  const rosterPct = players.get(cleanId)?.rosterPct;
  return { id: cleanId, name: getPlayerName(players, cleanId), position: getPlayerPosition(players, cleanId)?.toUpperCase(), team: players.get(cleanId)?.team, rosterPct };
}

export const GET: RequestHandler = async ({ cookies, url }) => {
  const cookie = cookies.get(MFL_COOKIE_NAME);
  const type = url.searchParams.get('type');
  const leagueId = url.searchParams.get('league');
  const daysParam = url.searchParams.get('days');
  const days = daysParam === 'all' ? undefined : (parseInt(daysParam || '7') || 7);

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
        const leagueIds = leagueId.split(',').map(id => id.trim()).filter(Boolean);
        const currentYear = await getCurrentYear();
        const players = await loadPlayerCache(cookie);
        const includeTrades = url.searchParams.get('includeTrades') === 'true';

        const leagueErrors: string[] = [];
        const leagueResults = await Promise.all(leagueIds.map(async (lid) => {
          try {
            const [transactions, league] = await Promise.all([
              getTransactions(lid, cookie, days),
              getLeagueFull(lid, cookie)
            ]);
            return { leagueId: lid, leagueName: league?.name || lid, transactions, franchiseMap: league?.franchises || new Map<string, string>() };
          } catch (e) {
            leagueErrors.push(`${lid}: ${e instanceof Error ? e.message : String(e)}`);
            console.error(`Failed to fetch data for league ${lid}:`, e);
            return null;
          }
        }));

        if (leagueResults.every(r => r === null)) {
          return json({ transactions: [], error: `MFL request failed: ${leagueErrors.join('; ')}` }, { status: 502 });
        }

        const allEnriched: MFLTransaction[] = [];
        for (const result of leagueResults) {
          if (!result) continue;
          const { leagueId: lid, leagueName, transactions, franchiseMap } = result;
          for (const t of transactions) {
            const franchiseName = getFranchiseName(franchiseMap, t.franchise);
            let enriched: MFLTransaction;
            
            if (t.type === 'TRADE') {
              const f1Gave = t.franchise1_gave_up?.split(',').filter(Boolean) || [];
              const f2Gave = t.franchise2_gave_up?.split(',').filter(Boolean) || [];
              
              const f1Names = f1Gave.map(id => resolveTradeItem(id, players, currentYear));
              const f2Names = f2Gave.map(id => resolveTradeItem(id, players, currentYear));

              const formattedTime = t.timestamp ? formatTimestamp(t.timestamp) : '';
              const allPlayers = [...f1Names, ...f2Names];
              const maxRosterPct = Math.max(...allPlayers.map(p => p.rosterPct ?? 0), 0);

              enriched = {
                ...t,
                type: getTransactionDisplayName(t.type),
                playerNames: [...f1Names.map(p => p.name), ...f2Names.map(p => p.name)],
                playerName: [...f1Names.map(p => p.name), ...f2Names.map(p => p.name)].join(', '),
                franchiseName,
                tradePartnerName: t.franchise2 ? getFranchiseName(franchiseMap, t.franchise2) : undefined,
                tradeGives: f1Names,
                tradeReceives: f2Names,
                formattedTime,
                maxRosterPct,
                leagueId: lid,
                leagueName
              };
            } else {
              let bid: string | undefined;
              let added: string[];
              let dropped: string[];
              if (t.type === 'BBID_WAIVER' && t.transaction) {
                const parsed = parseBBIDWaiverTransaction(t.transaction);
                added = parsed.added;
                dropped = parsed.dropped;
                bid = parsed.bid;
              } else if (t.transaction) {
                const parsed = parseFreeAgentTransaction(t.transaction);
                added = parsed.added;
                dropped = parsed.dropped;
                bid = t.bid;
              } else {
                added = [];
                dropped = [];
                bid = t.bid;
              }
              
              const addedPlayers = added.map(id => {
                const rosterPct = players.get(id)?.rosterPct;
                return { id, name: getPlayerName(players, id), position: getPlayerPosition(players, id)?.toUpperCase(), team: players.get(id)?.team, rosterPct };
              });
              const droppedPlayers = dropped.map(id => {
                const rosterPct = players.get(id)?.rosterPct;
                return { id, name: getPlayerName(players, id), position: getPlayerPosition(players, id)?.toUpperCase(), team: players.get(id)?.team, rosterPct };
              });
              
              const formattedTime = t.timestamp ? formatTimestamp(t.timestamp) : '';
              const maxRosterPct = Math.max(...droppedPlayers.map(p => p.rosterPct ?? 0), 0);
              enriched = {
                ...t,
                type: getTransactionDisplayName(t.type),
                addedPlayers,
                droppedPlayers,
                playerNames: [...addedPlayers.map(p => p.name), ...droppedPlayers.map(p => p.name)],
                playerName: [...addedPlayers.map(p => p.name), ...droppedPlayers.map(p => p.name)].join(', ') || undefined,
                franchiseName,
                formattedTime,
                bid,
                maxRosterPct,
                leagueId: lid,
                leagueName
              };
            }
            allEnriched.push(enriched);
          }
        }

        let filtered = includeTrades ? allEnriched : allEnriched.filter(t => t.type !== 'Trade');
        filtered.sort((a, b) => {
          const pctDiff = (b.maxRosterPct || 0) - (a.maxRosterPct || 0);
          if (pctDiff !== 0) return pctDiff;
          return (parseInt(b.timestamp || '0', 10) - parseInt(a.timestamp || '0', 10));
        });
        return json({ transactions: filtered });
      }

      case 'pendingWaivers': {
        if (!leagueId) {
          return json({ error: 'League ID required' }, { status: 400 });
        }
        const leagueIds = leagueId.split(',').map(id => id.trim()).filter(Boolean);
        const players = await loadPlayerCache(cookie);

        const waiverErrors: string[] = [];
        const leagueResults = await Promise.all(leagueIds.map(async (lid) => {
          try {
            const [waivers, league] = await Promise.all([
              getPendingWaivers(lid, cookie),
              getLeagueFull(lid, cookie)
            ]);
            return { leagueId: lid, leagueName: league?.name || lid, waivers, franchiseMap: league?.franchises || new Map<string, string>() };
          } catch (e) {
            waiverErrors.push(`${lid}: ${e instanceof Error ? e.message : String(e)}`);
            console.error(`Failed to fetch pending waivers for league ${lid}:`, e);
            return null;
          }
        }));

        if (leagueResults.every(r => r === null)) {
          return json({ pendingWaivers: [], error: `MFL request failed: ${waiverErrors.join('; ')}` }, { status: 502 });
        }

        const allEnriched: MFLPendingWaiver[] = [];
        for (const result of leagueResults) {
          if (!result) continue;
          const { leagueId: lid, leagueName, waivers, franchiseMap } = result;
          for (const w of waivers) {
            const claims: ParsedWaiverClaim[] = w.addsDrops.split(',').map(claim => {
              const parts = claim.split('_');
              const playerId = parts[0] || '';
              const bid = parts[1] || '0';
              const dropId = parts[2];
              const dropPlayerId = dropId && dropId !== '0000' ? dropId : undefined;

              const addedPlayer = {
                id: playerId,
                name: getPlayerName(players, playerId),
                position: getPlayerPosition(players, playerId)?.toUpperCase(),
                team: players.get(playerId)?.team,
                rosterPct: players.get(playerId)?.rosterPct
              };

              const droppedPlayer = dropPlayerId ? {
                id: dropPlayerId,
                name: getPlayerName(players, dropPlayerId),
                position: getPlayerPosition(players, dropPlayerId)?.toUpperCase(),
                team: players.get(dropPlayerId)?.team,
                rosterPct: players.get(dropPlayerId)?.rosterPct
              } : undefined;

              return { playerId, bid, dropPlayerId, addedPlayer, droppedPlayer };
            });

            const allPlayers = claims.flatMap(c => [c.addedPlayer, c.droppedPlayer].filter(Boolean));
            const maxRosterPct = Math.max(...allPlayers.map(p => p!.rosterPct ?? 0), 0);
            const commentsFormatted = w.comments.replace(/br\//g, '\n');
            const franchiseName = franchiseMap.values().next().value || 'Your Team';

            allEnriched.push({
              ...w,
              claims,
              maxRosterPct,
              formattedTime: formatTimestamp(w.timestamp),
              commentsFormatted,
              franchiseName,
              leagueId: lid,
              leagueName
            });
          }
        }

        allEnriched.sort((a, b) => (b.maxRosterPct || 0) - (a.maxRosterPct || 0));
        return json({ pendingWaivers: allEnriched });
      }

      case 'freeAgents': {
        if (!leagueId) {
          return json({ error: 'League ID required' }, { status: 400 });
        }
        const leagueIds = leagueId.split(',').map(id => id.trim()).filter(Boolean);
        const players = await loadPlayerCache(cookie);

        const faErrors: string[] = [];
        const leagueResults = await Promise.all(leagueIds.map(async (lid) => {
          try {
            const freeAgents = await getFreeAgents(lid, cookie);
            return { leagueId: lid, freeAgents };
          } catch (e) {
            faErrors.push(`${lid}: ${e instanceof Error ? e.message : String(e)}`);
            console.error(`Failed to fetch free agents for league ${lid}:`, e);
            return null;
          }
        }));

        if (leagueResults.every(r => r === null)) {
          return json({ freeAgents: [], error: `MFL request failed: ${faErrors.join('; ')}` }, { status: 502 });
        }

        const unionMap = new Map<string, { id: string; locked: boolean; availableIn: string[] }>();
        for (const result of leagueResults) {
          if (!result) continue;
          const { leagueId: lid, freeAgents } = result;
          for (const fa of freeAgents) {
            const existing = unionMap.get(fa.id);
            if (existing) {
              existing.locked = existing.locked || fa.status === 'locked';
              existing.availableIn.push(lid);
            } else {
              unionMap.set(fa.id, { id: fa.id, locked: fa.status === 'locked', availableIn: [lid] });
            }
          }
        }

        const freeAgents: MFLFreeAgent[] = [...unionMap.values()].map(p => ({
          id: p.id,
          name: getPlayerName(players, p.id),
          position: getPlayerPosition(players, p.id)?.toUpperCase(),
          team: players.get(p.id)?.team,
          rosterPct: players.get(p.id)?.rosterPct,
          locked: p.locked,
          availableIn: p.availableIn
        }));

        freeAgents.sort((a, b) => {
          if (!!a.locked !== !!b.locked) return a.locked ? 1 : -1;
          return (b.rosterPct || 0) - (a.rosterPct || 0);
        });

        warmPlayerImages(freeAgents.map(fa => fa.id), 6).catch(err =>
          console.error('Free agent image warm failed:', err)
        );

        return json({ freeAgents });
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