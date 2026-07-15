import { json } from '@sveltejs/kit';
import { verifySignedAction } from '$lib/server/signedAction';
import { isSafeWebhookUrl } from '$lib/server/webhookGuard';

// The webhook URL is owner-only state: every method here requires a payload
// signed with the room's private key (see $lib/server/signedAction).

export async function PATCH({ request }) {
  const verdict = await verifySignedAction(await request.json(), 'webhook:set');
  if (!verdict.ok) return json({ status: verdict.status, body: verdict.message });

  const { listener, params } = verdict;
  const webhookUrl = params.webhookUrl;

  if (typeof webhookUrl !== 'string' || webhookUrl.length > 2048) {
    return json({ status: 400, body: 'webhookUrl must be a string of at most 2048 chars' });
  }
  // Empty string clears the webhook.
  if (webhookUrl !== '' && !isSafeWebhookUrl(webhookUrl)) {
    return json({ status: 400, body: 'webhookUrl must be a public http(s) URL' });
  }

  try {
    listener.webhookUrl = webhookUrl;
    await listener.save();
    return json({ status: 200, body: { message: 'Webhook URL updated successfully' } });
  } catch (error) {
    console.error('Error updating webhook URL:', error);
    return json({ status: 500, body: 'Error updating webhook URL' });
  }
}

// Signed read. POST rather than GET because the armored signature doesn't
// travel well in a query string.
export async function POST({ request }) {
  const verdict = await verifySignedAction(await request.json(), 'webhook:read');
  if (!verdict.ok) return json({ status: verdict.status, body: verdict.message });

  return json({ status: 200, body: { webhookUrl: verdict.listener.webhookUrl ?? '' } });
}
