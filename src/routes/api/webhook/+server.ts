import { json } from '@sveltejs/kit';
import Listener from '../../../models/listener.schema';

export async function PATCH({ request }) {
  const body = await request.json();
  const { rid, webhookUrl } = body;
  console.log('Updating webhook with:', { rid, webhookUrl });

  if (!rid || !webhookUrl) {
    return json({ status: 400, body: 'Missing required fields' });
  }

  try {
    // First verify the listener exists
    const existingListener = await Listener.findOne({ rid });
    
    if (!existingListener) {
      return json({ status: 404, body: 'Listener not found' });
    }

    // Update the webhook URL
    existingListener.webhookUrl = webhookUrl;
    await existingListener.save();

    return json({ 
      status: 200, 
      body: { 
        message: 'Webhook URL updated successfully',
        listener: existingListener 
      }
    });

  } catch (error) {
    console.error('Error updating webhook URL:', error);
    return json({ status: 500, body: 'Error updating webhook URL' });
  }
}


export async function GET({ url }) {
  const rid = url.searchParams.get('rid');
  
  try {
    const listener = await Listener.findOne({ rid });
    
    if (listener) {
      return json({ status: 200, body: { webhookUrl: listener.webhookUrl } });
    } else {
      return json({ status: 404, body: 'Listener not found' });
    }
  } catch (error) {
    console.error(error);
    return json({ status: 500, body: 'Error retrieving webhook URL' });
  }
}
