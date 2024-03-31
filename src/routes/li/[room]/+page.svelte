<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import colors from '$lib/utils/colors.json';

	import * as openpgp from 'openpgp';
	import Message from '$lib/_components/Message.svelte';
	console.log(colors);

	let rid = $page.params.room;
	let unlocked = false;
	let unpacking = false;
	let unlockKey = '';
	let prKey: string;
	let encryptedMessages: any[] = [];
	let decryptedMessages: any[] = [];
	let passphrase = 'super long and hard to guess secret';

	$: unlocked = unlockKey === 'unlock';
	// if the pgp hash of the values in the localstorage are equal to the hash in the url , then unlock the page

	async function createShortHash(input: string, length: number): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(input);
		const hash = await window.crypto.subtle.digest('SHA-256', data);
		const hashString = btoa(String.fromCharCode(...new Uint8Array(hash)));

		const base64url = hashString.replace('+', '-').replace('/', '_').replace(/=+$/, '');
		return base64url.substring(0, length);
	}

	const CheckIfUnlockable = async () => {
		prKey = localStorage.getItem('prKey')!;
		const pbKey = localStorage.getItem('pbKey')!;
		const uniqueString = localStorage.getItem('uniqueString')!;
		console.log('Getting Pgp Identity from localStorage');

		const hash = await createShortHash(prKey + pbKey, 12);
		const unlockable = hash === rid && uniqueString === rid;
		console.log('Unlockable:', unlockable);
		return unlockable;
	};

	function stringToHex(str: string) {
		let hex = '';
		for (let i = 0; i < str.length; i++) {
			hex += str.charCodeAt(i).toString(16);
		}
		return hex.substring(0, 6);
	}
	function generateConsistentIndices(input: string) {
		let hash = 0;
		for (let i = 0; i < input.length; i++) {
			hash = (hash << 5) - hash + input.charCodeAt(i);
			hash |= 0; // Convert to 32bit integer
		}

		let index1 = Math.abs(hash % 992);
		let index2 = Math.abs(hash % 5);

		return colors[index1][index2];
	}

	const unpack = async () => {
		if (unlocked) {
			unpacking = true;
			const response = await fetch(`/api/pgp?r=${rid}`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			const resp = await response.json();

			if (resp.error) {
				console.log(resp.message);
			} else {
				encryptedMessages = resp.body.messages;

				for (const encryptedMessage of encryptedMessages) {
					const readMsg = await openpgp.readMessage({
						armoredMessage: encryptedMessage.message
					});
					const privateKey = await openpgp.decryptKey({
						privateKey: await openpgp.readPrivateKey({ armoredKey: prKey }),
						passphrase
					});

					const { data: decrypted } = await openpgp.decrypt({
						message: readMsg,
						decryptionKeys: privateKey
					});
					const msgObj = { msg: String(decrypted), r: encryptedMessage.r };

					if (!decryptedMessages.some((obj) => obj.msg === msgObj.msg && obj.r === msgObj.r)) {
						decryptedMessages.push(msgObj);
					}
					decryptedMessages = [...decryptedMessages];
				}
			}
			unpacking = false;
		}
	};

	let copied = false;

	async function copyLink() {
		await navigator.clipboard.writeText('https://sma.robi.work/b/' + rid);
		copied = true;
		setTimeout(() => (copied = false), 2000); // Reset after 2 seconds
	}

	let pollingInterval = 10;
	let intervalId: any;

	$: {
		if (pollingInterval > 3 && unlocked) {
			clearInterval(intervalId);
			intervalId = setInterval(unpack, pollingInterval * 1000);
		}
	}
	onMount(async () => {
		// Check if the user has a PGP identity
		if (rid) {
			console.log('Checking if unlockable');
			unlocked = await CheckIfUnlockable();
		}
		// add a constant loop that calls unpack
		unpack();
		if (unlocked) {
			if (intervalId) clearInterval(intervalId);
			intervalId = setInterval(unpack, pollingInterval * 1000);
		}
	});
</script>

<div
	class="container mx-auto flex min-h-screen w-full max-w-4xl flex-grow flex-col items-center justify-start p-1 pt-8"
>
	<div class="flex w-full flex-row gap-2 p-1">
		<h1 class=" relative w-full bg-stone-200 p-4 text-left text-4xl font-semibold text-stone-600">
			Room <span class="rounded-sm bg-stone-300 p-1 font-extralight">
				{rid}
			</span>
			{#if unlocked}
				<span
					class="absolute -top-2 left-1 rounded-sm bg-stone-700 p-1 px-2 text-sm font-light text-stone-50"
					>Your</span
				>
			{/if}
			{#if unpacking}
				<span
					class="absolute -bottom-2 left-1 rounded-sm border border-black bg-stone-200 p-1 px-2 text-xs font-normal text-stone-800"
					>Loading ...
				</span>
			{/if}
			<span
				class="absolute -bottom-2 right-1 rounded-sm border border-black bg-stone-200 p-1 px-2 text-xs font-normal text-stone-800"
				>Fetch messages every

				<input bind:value={pollingInterval} class="w-12" type="number" min="3" />
				seconds
			</span>
		</h1>
		<button class="btn bg-stone-50 transition-all" on:click={copyLink}>
			{copied ? 'Link copied!' : 'Share your link'}
		</button>
	</div>

	<div class="flex w-full flex-col gap-3 p-4">
		{#if unlocked}
			{#each [...decryptedMessages].reverse() as msg }
				{@const color = generateConsistentIndices(msg.r)}
				<Message {msg} {color} />
			{/each}
			{#if !decryptedMessages.length}
				<span class="p-12"> No messages sent to your inbox yet </span>
			{/if}
		{/if}
	</div>
</div>
