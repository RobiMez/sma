// src/lib/profanityFilter.ts

function checkProfanity(message: string) {
	console.log('Checking profanity...'); // Log statement
	return fetch('https://vector.profanity.dev', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ message }),
	})
		.then(res => {
			if (!res.ok) {
				throw new Error(`API request failed with status ${res.status}`);
			}
			return res.json();
		})
		.catch(error => {
			console.error('Error checking profanity:', error);
			throw error;
		});
}

export default checkProfanity;
