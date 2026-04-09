import type { PageServerLoad } from './$types';
import { getMyLeagues } from '$lib/api';

export const load: PageServerLoad = async ({ cookies }) => {
  const cookie = cookies.get('mfl_cookie');
  
  if (!cookie) {
    return {
      loggedIn: false,
      leagues: []
    };
  }
  
  try {
    const leagues = await getMyLeagues(cookie);
    return {
      loggedIn: true,
      leagues
    };
  } catch (error) {
    console.error('Failed to load leagues:', error);
    return {
      loggedIn: false,
      leagues: [],
      error: 'Failed to load leagues'
    };
  }
};