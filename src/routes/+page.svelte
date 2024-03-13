<script lang="ts">
	import * as openpgp from 'openpgp';
	import { onMount } from 'svelte';

	let prKey: string;
	let pbKey: string;
	let RC: string;
	let uniqueString: string;

	async function createShortHash(input: string, length: number): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(input);
		const hash = await window.crypto.subtle.digest('SHA-256', data);
		const hashString = btoa(String.fromCharCode(...new Uint8Array(hash)));

		const base64url = hashString.replace('+', '-').replace('/', '_').replace(/=+$/, '');
		return base64url.substring(0, length);
	}
	const GetPgpIdentity = async () => {
		prKey = localStorage.getItem('prKey')!;
		pbKey = localStorage.getItem('pbKey')!;
		RC = localStorage.getItem('RC')!;
		uniqueString = localStorage.getItem('uniqueString')!;
		console.log('Getting Pgp Identity from localStorage');

		return { prKey, pbKey, RC, uniqueString };
	};

	// On click , ill generate the required hashes and links and redir the user to that page
	const ResetPgpIdentity = () => {
		(async () => {
			const { privateKey, publicKey, revocationCertificate } = await openpgp.generateKey({
				type: 'ecc',
				curve: 'curve25519',
				userIDs: [{ name: 'Anon', email: 'Sma@robi.work' }],
				passphrase: 'super long and hard to guess secret',
				format: 'armored'
			});
			prKey = privateKey;
			pbKey = publicKey;
			RC = revocationCertificate;

			uniqueString = await createShortHash(privateKey + publicKey, 12);

			localStorage.setItem('prKey', prKey);
			localStorage.setItem('pbKey', pbKey);
			localStorage.setItem('RC', RC);
			localStorage.setItem('uniqueString', uniqueString);

			const response = await fetch('/api/pgp', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					pbKey,
					rid: uniqueString
				})
			});

			const resp = await response.json();

			if (resp.error) {
				console.log(resp.message);
			} else {
				console.log(resp.message);
			}

			// Create a unique string based on the keys
		})();
	};

	onMount(async () => {
		// Check if the user has a PGP identity
		if (!prKey || !pbKey || !RC || !uniqueString) {
			({ prKey, pbKey, RC, uniqueString } = await GetPgpIdentity());
		}
		if (!prKey || !pbKey || !RC || !uniqueString) {
			console.log('No Pgp Identity found , creating one now');
			ResetPgpIdentity();
		}
	});
</script>

<div
	class="container mx-auto flex min-h-screen max-w-4xl flex-grow flex-col items-center justify-center gap-8 p-8"
>
	<span class="flex flex-col items-center justify-center gap-2">
		<h1 class="text-4xl font-black text-stone-700">Welcome to S.M.A</h1>
		<h6 class="text-lg font-extralight">Send Messages Anon</h6>
	</span>

	<div class="flex flex-row items-center justify-center gap-4">
		<a href="#0" class="btn" on:click={ResetPgpIdentity}> Reset Identity </a>
		<div class="relative">
			<a class="btn" href="/li/{uniqueString}"> Your Messages </a>
			<h1 class="absolute -bottom-8 -right-1 border border-black bg-stone-300 p-1 text-xs">
				{uniqueString ?? ''}
			</h1>
		</div>
	</div>
	<div class="flex flex-col items-center justify-center gap-4 pt-2">
		<div class="flex flex-row gap-4">
			<div class="relative border border-black bg-stone-200 p-2">
				<small class="absolute -top-3 rounded-sm bg-stone-800 px-1 text-stone-200"
					>{prKey ? 'Private Key ( Super secret , dont share )' : ''}</small
				>
				<h1 class=" text-xs">{prKey ?? ''}</h1>
			</div>

			<div class="relative border border-black bg-stone-50 p-2">
				<small class="absolute -top-3 rounded-sm bg-stone-800 px-1 text-stone-200"
					>{pbKey ? 'Public Key ( Share as you like ) ' : ''}</small
				>
				<h1 class=" text-xs">{pbKey ?? ''}</h1>
			</div>
		</div>
	</div>
</div>
