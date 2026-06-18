import { dispatch } from '@/lib/server/router';

export const dynamic = 'force-dynamic';

async function handle(request, { params }) {
  const segments = (await params).path ?? [];
  return dispatch(request, segments);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const PATCH = handle;
