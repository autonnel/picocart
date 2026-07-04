import type { APIRoute } from 'astro';
import { deleteSession, SESSION_COOKIE_NAME } from '@/lib/auth/session';

export const GET: APIRoute = async ({ cookies, redirect }) => {
  const sessionToken = cookies.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    await deleteSession(sessionToken);
  }

  cookies.delete(SESSION_COOKIE_NAME);

  return redirect('/', 302);
};
