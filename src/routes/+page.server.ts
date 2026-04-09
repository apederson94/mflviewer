import type { PageServerLoad } from './$types';
import { getMyLeagues, getCurrentWeek } from '$lib/api';

export const load: PageServerLoad = async ({ cookies }) => {
  const cookie = cookies.get('mfl_cookie');
  const week = await getCurrentWeek();
  
  if (!cookie) {
    return {
      loggedIn: false,
      leagues: [],
      week
    };
  }
  
  try {
    const leagues = await getMyLeagues(cookie);
    return {
      loggedIn: true,
      leagues,
      week
    };
  } catch (error) {
    console.error('Failed to load leagues:', error);
    return {
      loggedIn: false,
      leagues: [],
      error: 'Failed to load leagues',
      week
    };
  }
};