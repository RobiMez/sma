<script lang="ts">
	import * as openpgp from 'openpgp';
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';

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
	interface Stats {
		activeUsers: number;
		identities: number;
		totalMessages: number;
	}
	let stats: Stats;
	let powerUser: boolean = false;
	onMount(async () => {
		// Check if the user has a PGP identity
		if (!prKey || !pbKey || !RC || !uniqueString) {
			({ prKey, pbKey, RC, uniqueString } = await GetPgpIdentity());
		}
		if (!prKey || !pbKey || !RC || !uniqueString) {
			console.log('No Pgp Identity found , creating one now');
			ResetPgpIdentity();
		}

		const response = await fetch(`/api/stats`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});

		const resp = await response.json();
		console.log('response:', resp.body);
		if (resp.error) {
			stats = { activeUsers: -1, identities: -1, totalMessages: -1 };
			console.log(resp.message);
		} else {
			stats = resp.body;
			console.log(resp.message);
		}
	});
</script>

<div
	class="container mx-auto flex min-h-screen max-w-4xl flex-grow flex-col items-center justify-center gap-8 p-8"
>
	<span class="flex flex-col items-center justify-center gap-2">
		<h1
			class="
			text-primary/80 text-4xl font-extralight
			transition-all md:text-5xl lg:text-6xl"
		>
			Welcome to S.M.A
		</h1>
		<h6 class="text-md font-extralight md:text-lg lg:text-xl">Send Messages Anon</h6>
		{#if stats}
			<small in:fade class="text-primary/80 text-xs font-normal">
				<b>{stats.activeUsers ?? ''}</b> Active users ,
				<b>{stats.identities}</b> Identities ,
				<b>{stats.totalMessages}</b> Msgs and counting...
			</small>
		{:else}
			<small class="text-primary text-xs font-light"> Loading Stats... </small>
		{/if}
	</span>

	<div class="flex flex-row items-center justify-center gap-4">
		<a href="#0" class="btn btn-primary btn-outline" on:click={ResetPgpIdentity}>
			Reset Identity
		</a>
		<div class="relative">
			<a class="btn btn-primary" href="/li/{uniqueString}"> Your Messages </a>
			<h1
				class="border-primary text-primary bg-base-100 absolute -bottom-4 -right-1 border p-1 text-xs"
			>
				{uniqueString ?? ''}
			</h1>
		</div>
	</div>
	<div class="flex flex-col items-center justify-center gap-4 pt-2">
		<button
			class="btn btn-sm"
			on:click={() => {
				powerUser = !powerUser;
			}}
		>
			{powerUser ? 'Hide' : 'Show'}
			PGP tools</button
		>
		{#if powerUser}
			<div class="flex max-w-[80vw] flex-col gap-4 lg:flex-row py-4" transition:slide>
				<div class="relative border border-black p-2">
					<small class="bg-primary text-primary-content absolute -top-3 z-40 rounded-sm px-1"
						>{prKey ? 'Private Key ( Super secret , dont share )' : ''}</small
					>
					<h1 class=" break-all text-xs blur-sm transition-all duration-1000 hover:blur-none">
						{prKey ?? ''}
					</h1>
				</div>

				<div class="relative border border-black p-2">
					<small class="bg-primary text-primary-content absolute -top-3 z-40 rounded-sm px-1"
						>{pbKey ? 'Public Key ( Share as you like ) ' : ''}</small
					>
					<h1 class=" break-all text-xs">{pbKey ?? ''}</h1>
				</div>
			</div>
		{/if}
	</div>

	<footer class="
	text-primary fixed bottom-0 flex w-full items-center 
	bg-base-100 justify-center z-50">
		<span class="p-1 text-sm font-extralight"
			>A <a class="underline" href="https://robi.work">robi.work</a> site
		</span>
	</footer>
</div>
