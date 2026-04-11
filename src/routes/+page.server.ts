import type { PageServerLoad } from './$types';
import { getMyLeagues, getCurrentWeek, loadPlayerCache, MFL_COOKIE_NAME } from '$lib/api';

export const load: PageServerLoad = async ({ cookies }) => {
  const cookie = cookies.get(MFL_COOKIE_NAME);
  const week = await getCurrentWeek();
  
  if (!cookie) {
    return {
      loggedIn: false,
      leagues: [],
      week,
      players: []
    };
  }
  
  try {
    const [leagues, players] = await Promise.all([
      getMyLeagues(cookie),
      loadPlayerCache(cookie)
    ]);
    return {
      loggedIn: true,
      leagues,
      week,
      players: Array.from(players.entries())
    };
  } catch (error) {
    console.error('Failed to load data:', error);
    return {
      loggedIn: false,
      leagues: [],
      error: 'Failed to load data',
      week,
      players: []
    };
  }
};