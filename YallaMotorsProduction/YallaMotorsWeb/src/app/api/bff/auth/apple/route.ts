import { handleSocialAuth } from '@/lib/auth/oauth';

export const dynamic = 'force-dynamic';
export const POST = (request: Request) => handleSocialAuth(request, 'apple');

