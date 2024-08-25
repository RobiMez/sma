async function checkProfanity(message: string) {
  try {
    const res = await fetch('https://vector.profanity.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    if (!res.ok) {
      throw new Error(`API request failed with status ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error('Error checking profanity:', error);
    throw error;
  }
}

export default checkProfanity;
