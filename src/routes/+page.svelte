<script lang="ts">
	import * as openpgp from 'openpgp';
	import DOMPurify from 'dompurify';
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import packageJson from '../../package.json';
	import content from '../../CHANGELOG.md';
	import { marked } from 'marked';
	import { browser } from '$app/environment';

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
	let changelog = '';
	let powerUser: boolean = false;
	let displayChangelog: boolean = false;
	let newChangelog: boolean = false;

	onMount(async () => {
		changelog = await marked(content);
		changelog = DOMPurify.sanitize(changelog);

		if (localStorage.getItem('LastReadChangelog') === packageJson.version) {
			displayChangelog = false;
		} else {
			displayChangelog = true;
			newChangelog = true;
		}

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
	class="container mx-auto flex max-h-fit min-h-screen max-w-2xl flex-grow flex-col items-center justify-center gap-8 p-8"
>
	<span class="flex flex-col items-center justify-center gap-2">
		<h1
			class="
			relative text-xl font-extralight transition-all sm:text-2xl
			md:text-3xl lg:text-4xl"
		>
			Welcome to S.M.A
			{#if browser}
				<a
					class="absolute -bottom-6 -right-6 rounded-sm bg-base-300 p-1 text-base
					cursor-pointer
        "
					on:click={() => {
						localStorage.setItem('LastReadChangelog', packageJson.version);
						newChangelog = false;
						displayChangelog = !displayChangelog;
					}}
				>
					V{packageJson.version}
					{!newChangelog ? '' : ' ✨ '}
				</a>
			{/if}
		</h1>

		<h6 class="text-md font-extralight md:text-lg lg:text-xl">Send Messages Anon</h6>
		{#if stats}
			<small in:fade class="text-sm font-normal text-primary/80">
				<b>{stats.activeUsers ?? ''}</b> Active users ,
				<b>{stats.identities}</b> Identities ,
				<b>{stats.totalMessages}</b> Msgs and counting...
			</small>
		{:else}
			<small class="text-sm font-light text-primary"> Loading Stats... </small>
		{/if}
	</span>
	{#if displayChangelog}
		<div transition:slide class="changelog max-w-lg">
			{@html changelog}
		</div>
	{/if}

	<div class="flex flex-row items-center justify-center gap-4">
		<a href="#0" class="btn btn-outline btn-primary" on:click={ResetPgpIdentity}>
			Reset Identity
		</a>
		<div class="relative">
			<a class="btn btn-primary" href="/li/{uniqueString}"> Your Messages </a>
			<h1
				class="absolute -bottom-4 -right-1 border border-primary bg-base-100 p-1 text-xs text-primary"
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
			<div class="flex max-w-[80vw] flex-col gap-4 py-4 lg:flex-row" transition:slide>
				<div class="relative border border-black p-2">
					<small class="absolute -top-3 z-40 rounded-sm bg-primary px-1 text-primary-content"
						>{prKey ? 'Private Key ( Super secret , dont share )' : ''}</small
					>
					<h1 class=" break-all text-xs blur-sm transition-all duration-1000 hover:blur-none">
						{prKey ?? ''}
					</h1>
				</div>

				<div class="relative border border-black p-2">
					<small class="absolute -top-3 z-40 rounded-sm bg-primary px-1 text-primary-content"
						>{pbKey ? 'Public Key ( Share as you like ) ' : ''}</small
					>
					<h1 class=" break-all text-xs">{pbKey ?? ''}</h1>
				</div>
			</div>
		{/if}
	</div>

	<footer
		class="
	fixed bottom-0 z-50 flex w-full items-center
	justify-center bg-base-100 text-primary"
	>
		<span class="p-1 text-sm font-extralight"
			>A <a class="underline" href="https://robi.work">robi.work</a> site
		</span>
	</footer>
</div>
