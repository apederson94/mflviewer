import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MFL_COOKIE_NAME } from '$lib/api';

export const POST: RequestHandler = async ({ cookies }) => {
  cookies.delete(MFL_COOKIE_NAME, { path: '/' });
  return json({ success: true });
};