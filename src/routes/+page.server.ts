import type { PageServerLoad } from './$types';
import { getMyLeagues, getCurrentWeek, getCurrentYear, loadPlayerCache, MFL_COOKIE_NAME } from '$lib/api';

export const load: PageServerLoad = async ({ cookies }) => {
  const cookie = cookies.get(MFL_COOKIE_NAME);
  const [week, year] = await Promise.all([getCurrentWeek(), getCurrentYear()]);
  
  if (!cookie) {
    return {
      loggedIn: false,
      leagues: [],
      week,
      year,
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
      year,
      players: Array.from(players.entries())
    };
  } catch (error) {
    console.error('Failed to load data:', error);
    return {
      loggedIn: false,
      leagues: [],
      error: 'Failed to load data',
      week,
      year,
      players: []
    };
  }
};