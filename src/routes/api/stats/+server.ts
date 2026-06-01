import { json } from '@sveltejs/kit';
import Listener from '../../../models/listener.schema';

// Public aggregate counts — readable from any origin (e.g. portfolio badges).
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=60'
};

export async function GET({ url }) {
  const lim = parseInt(url.searchParams.get('lim') ?? '100');

  const activeUsers = await Listener.find(
    { $expr: { $gt: [{ $size: '$messages' }, 4] } }
    // {
    //   messages: { $slice: -lim }
    // }
  );

  const totalmessages = activeUsers.reduce((acc, user) => acc + user.messages.length, 0);
  const identities = await Listener.distinct('rid');

  return json(
    {
      status: 200,
      body: {
        activeUsers: activeUsers.length,
        totalMessages: totalmessages,
        identities: identities.length
      }
    },
    { headers: CORS_HEADERS }
  );
}

export function OPTIONS() {
  return new Response(null, {
    headers: {
      ...CORS_HEADERS,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Max-Age': '600'
    }
  });
}
