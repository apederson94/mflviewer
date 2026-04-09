import type {
  MFLTransactionsResponse,
  MFLTransaction,
  MFLMyLeaguesResponse,
  MFLPlayersResponse,
  StoredLeague
} from './types';

import type { MFLLoginResponse } from './types';

interface YearWeekCache {
  year: string;
  week: number;
  timestamp: number;
}

let yearWeekCache: YearWeekCache | null = null;

function isCacheValid(cache: YearWeekCache | null): boolean {
  if (!cache) return false;
  const now = new Date();
  const cacheDate = new Date(cache.timestamp);
  return now.toDateString() === cacheDate.toDateString();
}

export async function getYearAndWeek(): Promise<{ year: string; week: number }> {
  if (isCacheValid(yearWeekCache)) {
    return { year: yearWeekCache!.year, week: yearWeekCache!.week };
  }
  const url = 'https://api.myfantasyleague.com/fflnetdynamic2026/mfl_status.json';
  const response = await fetchJSON<{ mfl_status: { year: string; weeks: { CurrentWeek: string } } }>(url);
  yearWeekCache = {
    year: response.mfl_status.year,
    week: parseInt(response.mfl_status.weeks.CurrentWeek || '1', 10),
    timestamp: Date.now()
  };
  return { year: yearWeekCache.year, week: yearWeekCache.week };
}

export async function getCurrentYear(): Promise<string> {
  const { year } = await getYearAndWeek();
  return year;
}

export async function getCurrentWeek(): Promise<number> {
  const { week } = await getYearAndWeek();
  return week;
}

export async function getBaseUrl(): Promise<string> {
  const year = await getCurrentYear();
  return `https://api.myfantasyleague.com/${year}/export`;
}

export async function fetchJSON<T>(url: string, cookie?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  if (cookie) {
    headers['Cookie'] = cookie;
  }
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    throw new Error(`MFL API error: ${response.status}`);
  }
  
  const text = await response.text();
  
  if (!text) {
    throw new Error('Empty response from API');
  }
  
  return JSON.parse(text) as T;
}

export async function login(username: string, password: string): Promise<{ success: boolean; cookie: string }> {
  const year = await getCurrentYear();
  const encodedUsername = encodeURIComponent(username);
  const encodedPassword = encodeURIComponent(password);
  const loginUrl = `https://api.myfantasyleague.com/${year}/login?USERNAME=${encodedUsername}&PASSWORD=${encodedPassword}&XML=1`;
  
  const response = await fetch(loginUrl);
  const text = await response.text();
  
  if (!text) {
    return { success: false, cookie: '' };
  }

  if (text.includes('<error')) {
    return { success: false, cookie: '' };
  }
  
  const cookieMatch = text.match(/MFL_USER_ID="([^"]+)"/);
  
  if (cookieMatch) {
    const cookieValue = cookieMatch[1];
    return {
      success: true,
      cookie: `MFL_USER_ID=${cookieValue}`
    };
  }
  
  return { success: false, cookie: '' };
}

export async function getMyLeagues(cookie?: string): Promise<StoredLeague[]> {
  const baseUrl = await getBaseUrl();
  let url = `${baseUrl}?TYPE=myleagues&JSON=1`;
  
  const response = await fetchJSON<MFLMyLeaguesResponse>(url, cookie);
  
  if (!response.leagues?.league) {
    return [];
  }
  
  const leagues = Array.isArray(response.leagues.league)
    ? response.leagues.league
    : [response.leagues.league];
  
  return leagues.map(league => ({
    id: league.league_id,
    name: league.name
  }));
}

export async function getLeagueById(leagueId: string, cookie?: string): Promise<StoredLeague | null> {
  const baseUrl = await getBaseUrl();
  const url = `${baseUrl}?TYPE=league&L=${leagueId}&JSON=1`;
  
  try {
    const response = await fetchJSON<Record<string, unknown>>(url, cookie);
    
    const attrs = response['@attributes'] as Record<string, string> | undefined;
    if (attrs && (attrs.id || attrs.name)) {
      return {
        id: attrs.id || leagueId,
        name: attrs.name || 'Unknown League'
      };
    }
    
    if (response.id || response.name) {
      return {
        id: response.id as string,
        name: response.name as string
      };
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

export async function loadPlayerCache(cookie?: string): Promise<Map<string, { name: string; position: string }>> {
  const baseUrl = await getBaseUrl();
  const url = `${baseUrl}?TYPE=players&JSON=1`;
  const playerCache = new Map<string, { name: string; position: string }>();
  
  try {
    const response = await fetchJSON<MFLPlayersResponse>(url, cookie);
    if (response.players?.player) {
      const players = Array.isArray(response.players.player)
        ? response.players.player
        : [response.players.player];
      
      players.forEach(player => {
        playerCache.set(player.id, {
          name: player.name,
          position: player.position
        });
      });
    }
  } catch (error) {
    console.error('Failed to load player cache:', error);
  }
  
  return playerCache;
}

export function getPlayerName(playerCache: Map<string, { name: string; position: string }>, playerId: string): string {
  const player = playerCache.get(playerId);
  return player?.name || `Unknown (${playerId})`;
}

export function getPlayerPosition(playerCache: Map<string, { name: string; position: string }>, playerId: string): string {
  const player = playerCache.get(playerId);
  return player?.position || 'UNK';
}

export async function getTransactions(
  leagueId: string,
  cookie?: string,
  transType?: string,
  days?: number,
  week?: number
): Promise<MFLTransaction[]> {
  const baseUrl = await getBaseUrl();
  let url = `${baseUrl}?TYPE=transactions&L=${leagueId}&JSON=1`;
  
  if (transType) {
    url += `&TRANS_TYPE=${transType}`;
  }
  
  if (days) {
    url += `&DAYS=${days}`;
  } else if (week) {
    url += `&W=${week}`;
  }
  
  const response = await fetchJSON<MFLTransactionsResponse>(url, cookie);
  
  if (!response.transactions?.transaction) {
    return [];
  }
  
  const transactions = response.transactions.transaction;
  return Array.isArray(transactions) ? transactions : [transactions];
}