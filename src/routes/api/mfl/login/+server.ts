import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { login } from '$lib/api';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const formData = await request.formData();
  const username = formData.get('username')?.toString();
  const password = formData.get('password')?.toString();

  if (!username || !password) {
    return json({ success: false, error: 'Username and password required' }, { status: 400 });
  }

  try {
    const result = await login(username, password);
    
    if (result.success) {
      cookies.set('mfl_cookie', result.cookie, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30
      });
      
      return json({ success: true });
    }
    
    return json({ success: false, error: 'Invalid credentials' }, { status: 401 });
  } catch (error) {
    console.error('Login error:', error);
    return json({ success: false, error: 'Login failed' }, { status: 500 });
  }
};