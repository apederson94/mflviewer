import type {
  MFLTransactionsResponse,
  MFLTransaction,
  MFLMyLeaguesResponse,
  MFLPlayersResponse,
  StoredLeague,
  MFLFranchise,
  MFLLeagueResponse
} from './types';

import type { MFLLoginResponse } from './types';

export const MFL_COOKIE_NAME = 'mfl_cookie';

function toArray<T>(item: T | T[]): T[] {
  return Array.isArray(item) ? item : [item];
}

interface YearWeekCache {
  year: string;
  week: number;
  timestamp: number;
}

let yearWeekCache: YearWeekCache | null = null;

interface PlayerCache {
  players: Map<string, { name: string; position: string }>;
  timestamp: number;
}

let playerCache: PlayerCache | null = null;

function isCacheValid(cache: YearWeekCache | null): boolean {
  if (!cache) return false;
  const now = new Date();
  const cacheDate = new Date(cache.timestamp);
  return now.toDateString() === cacheDate.toDateString();
}

function isPlayerCacheValid(): boolean {
  if (!playerCache) return false;
  const now = new Date();
  const cacheDate = new Date(playerCache.timestamp);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const cacheDay = new Date(cacheDate.getFullYear(), cacheDate.getMonth(), cacheDate.getDate());
  return today.getTime() === cacheDay.getTime();
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
  
  console.log(`Fetching leagues, cookie present: ${!!cookie}`);
  
  try {
    const response = await fetchJSON<MFLMyLeaguesResponse>(url, cookie);
    const leagues = response.leagues?.league ? toArray(response.leagues.league) : [];
    
    console.log(`Fetched ${leagues.length} leagues, success: true`);
    
    return leagues.map(league => ({
      id: league.league_id,
      name: league.name
    }));
  } catch (error) {
    console.error(`Fetch leagues failed: ${error}`);
    throw error;
  }
}

export async function getLeagueById(leagueId: string, cookie?: string): Promise<StoredLeague | null> {
  const baseUrl = await getBaseUrl();
  const url = `${baseUrl}?TYPE=league&L=${leagueId}&JSON=1`;
  
  console.log(`Fetching league ${leagueId}`);
  
  try {
    const response = await fetchJSON<Record<string, unknown>>(url, cookie);
    const payloadSize = JSON.stringify(response).length;
    console.log(`Fetched league ${leagueId}, payload bytes: ${payloadSize}, success: true`);
    
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
  } catch (error) {
    console.error(`Fetch league ${leagueId} failed: ${error}`);
    return null;
  }
}

export interface LeagueFull {
  id: string;
  name: string;
  franchises: Map<string, string>;
}

export async function getLeagueFull(leagueId: string, cookie?: string): Promise<LeagueFull | null> {
  const baseUrl = await getBaseUrl();
  const url = `${baseUrl}?TYPE=league&L=${leagueId}&JSON=1`;
  
  const franchiseMap = new Map<string, string>();
  
  try {
    const response = await fetchJSON<MFLLeagueResponse>(url, cookie);
    
    const leagueIdVal = response.league?.id || leagueId;
    const leagueName = response.league?.name || 'Unknown League';
    
    if (response.league?.franchises?.franchise) {
      const franchises = toArray(response.league.franchises.franchise);
      
      franchises.forEach(franchise => {
        franchiseMap.set(franchise.id, franchise.name);
      });
    }
    
    console.log(`Fetched full league ${leagueId}, franchises: ${franchiseMap.size}`);
    
    return {
      id: leagueIdVal,
      name: leagueName,
      franchises: franchiseMap
    };
  } catch (error) {
console.error(`Fetch full league ${leagueId} failed: ${error}`);
    return null;
  }
}

export async function loadPlayerCache(cookie?: string): Promise<Map<string, { name: string; position: string }>> {
  if (isPlayerCacheValid() && playerCache) {
    return playerCache.players;
  }

  const baseUrl = await getBaseUrl();
  const url = `${baseUrl}?TYPE=players&JSON=1`;
  const playerCacheMap = new Map<string, { name: string; position: string }>();
  
  console.log(`Fetching players, cookie present: ${!!cookie}`);
  
  try {
    const response = await fetchJSON<MFLPlayersResponse>(url, cookie);
    const payloadSize = JSON.stringify(response).length;
    if (response.players?.player) {
      const players = toArray(response.players.player);
      
      players.forEach(player => {
        playerCacheMap.set(player.id, {
          name: player.name,
          position: player.position
        });
      });
    }
    
    playerCache = {
      players: playerCacheMap,
      timestamp: Date.now()
    };
    
    console.log(`Fetched ${playerCacheMap.size} players, payload bytes: ${payloadSize}, success: true`);
  } catch (error) {
    console.error(`Fetch players failed: ${error}`);
  }
  
  return playerCacheMap;
}

export function getPlayerName(playerCache: Map<string, { name: string; position: string }>, playerId: string): string {
  const player = playerCache.get(playerId);
  return player?.name || `Unknown (${playerId})`;
}

export function getPlayerPosition(playerCache: Map<string, { name: string; position: string }>, playerId: string): string {
  const player = playerCache.get(playerId);
  return player?.position || 'UNK';
}

export function getFranchiseName(franchiseCache: Map<string, string>, franchiseId: string): string {
  return franchiseCache.get(franchiseId) || `Franchise ${franchiseId}`;
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
  
  console.log(`Fetching transactions for league ${leagueId}`);
  
  try {
    const response = await fetchJSON<MFLTransactionsResponse>(url, cookie);
    const payloadSize = JSON.stringify(response).length;
    const hasTransactions = response.transactions?.transaction;
    const rawTx = response.transactions?.transaction;
    const txCount = rawTx ? toArray(rawTx).length : 0;
    
    console.log(`Fetched ${txCount} transactions for league ${leagueId}, payload bytes: ${payloadSize}, success: true`);
    
    if (!response.transactions?.transaction) {
      return [];
    }
    
    return toArray(response.transactions.transaction);
  } catch (error) {
    console.error(`Fetch transactions for league ${leagueId} failed: ${error}`);
    throw error;
  }
}