<script lang="ts">
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	import colors from '$lib/utils/colors.json';

	import * as openpgp from 'openpgp';
	import Message from '$lib/_components/Message.svelte';
	import PencilSimpleLine from 'phosphor-svelte/lib/PencilSimpleLine';
	import FloppyDisk from 'phosphor-svelte/lib/FloppyDisk';

	let rid = $page.params.room;
	let unlocked = false;
	let unpacking = false;
	let unlockKey = '';
	let prKey: string;
	let pbKey: string;
	let profanityFilterEnabled = false;
	let roomTitle = '';
	let isEditingTitle = false;

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
		pbKey = localStorage.getItem('pbKey')!;
		const uniqueString = localStorage.getItem('uniqueString')!;

		const hash = await createShortHash(prKey + pbKey, 12);
		return hash === rid && uniqueString === rid;
	};

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

	// Define an asynchronous function named 'unpack'
	const unpack = async () => {
		// Check if 'unlocked' is true
		if (unlocked) {
			// Set 'unpacking' to true
			unpacking = true;

			// Fetch the encrypted messages from the server
			const response = await fetch(`/api/pgp?r=${rid}`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			// Parse the JSON response
			const resp = await response.json();

			// If there's an error in the response, log the message
			if (resp.error) {
				console.log(resp.message);
			} else {
				// Otherwise, set 'encryptedMessages' to the messages from the response
				encryptedMessages = resp.body.messages;

				// Loop over each encrypted message
				for (const encryptedMessage of encryptedMessages) {
					// Read the encrypted message
					const readMsg = await openpgp.readMessage({
						armoredMessage: encryptedMessage.message
					});

					// Decrypt the private key
					const privateKey = await openpgp.decryptKey({
						privateKey: await openpgp.readPrivateKey({ armoredKey: prKey }),
						passphrase
					});

					// Decrypt the message with the private key
					const { data: decrypted } = await openpgp.decrypt({
						message: readMsg,
						decryptionKeys: privateKey
					});

					// Create an object with the decrypted message and its 'r' property
					const msgObj = {
						msg: String(decrypted),
						r: encryptedMessage.r,
						timestamp: encryptedMessage.timestamp ?? new Date(0).toISOString()
					};

					// If 'decryptedMessages' doesn't already contain this message, add it
					if (
						!decryptedMessages.some(
							(obj) =>
								obj.msg === msgObj.msg && obj.r === msgObj.r && obj.timestamp === msgObj.timestamp
						)
					) {
						decryptedMessages.push(msgObj);
					}
				}
				// Update 'decryptedMessages' to trigger reactivity in Svelte
				decryptedMessages = decryptedMessages;
			}
			// Set 'unpacking' to false
			unpacking = false;
		}
	};

	let copied = false;

	async function copyLink() {
		await navigator.clipboard.writeText($page.url.origin + '/b/' + rid);
		copied = true;
		setTimeout(() => (copied = false), 2000);
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
			unlocked = await CheckIfUnlockable();
		}
		// add a constant loop that calls unpack
		unpack();
		if (unlocked) {
			if (intervalId) clearInterval(intervalId);
			intervalId = setInterval(unpack, pollingInterval * 1000);
		}

		// if none set , default to false
		profanityFilterEnabled = false;

		await fetchRoomTitle();

		const response = await fetch('/api/prof', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ rid: rid })
		});

		const resp = await response.json();

		if (resp.error) {
			console.log(resp.message);
		} else {
			console.log(resp);

			profanityFilterEnabled = resp.body.profanityEnabled;
		}

		return clearInterval(intervalId);
	});

	const toggleEditTitle = () => {
		isEditingTitle = !isEditingTitle;
	};

	async function updateRoomTitle() {
		const responseUpdateTitle = await fetch('/api/titl', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				pbKey: pbKey,
				title: roomTitle
			})
		});

		const respUpdateTitle = await responseUpdateTitle.json();

		if (respUpdateTitle.error) {
			console.log(respUpdateTitle.message);
		} else {
			roomTitle = respUpdateTitle.body.title;
			console.log(`Title changed to "${respUpdateTitle.body.title}"`);
		}
	}

	async function fetchRoomTitle() {

		const responseTitle = await fetch(`/api/titl?rid=${rid}`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json'
			}
		});

		const respTitle = await responseTitle.json();


		if (respTitle.error) {
			console.log(respTitle.message);
		} else {
			roomTitle = respTitle.body.title;
		}
	}

	const updateProf = async (e: any) => {
		const response = await fetch('/api/prof', {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				pbKey: pbKey,
				profanityEnabled: e.target.checked ?? false
			})
		});

		const resp = await response.json();


		if (resp.error) {
			console.log(resp.message);
		} else {
			profanityFilterEnabled = resp.body.profanityEnabled;
			console.log(resp.body.profanityEnabled);
		}
	};
</script>

<div
	class="container mx-auto flex min-h-screen w-full max-w-4xl flex-grow flex-col items-center justify-start p-1 pt-8"
>
	<div class="flex w-full flex-row gap-2 p-1 pb-1">
		<h1
			class=" relative w-full bg-base-200 p-4 text-left text-xl
		font-semibold text-primary/90 md:text-3xl lg:text-4xl"
		>
			Room
			{#if isEditingTitle}
				<input
					bind:value={roomTitle}
					type="text"
					class="rounded-sm bg-base-300 p-1 font-extralight text-base-content border-none"
					size={roomTitle.length > 5 ? roomTitle.length : 5}
					style={`font-size: ${Math.ceil(roomTitle.length / 50)}em`}
				>
				<button on:click={() => {updateRoomTitle(); toggleEditTitle();}} class="btn btn-sm my-4"><FloppyDisk size="24" weight="duotone"/></button>
			{:else}
  <span class="pointer-events-none rounded-sm bg-base-300 p-1 font-extralight text-base-content border-none">
    {roomTitle}
  </span>
				<button on:click={toggleEditTitle} class="btn btn-sm my-4"><PencilSimpleLine size="24" weight="duotone"/></button>
			{/if}
			{#if unlocked}
				<span
					class="absolute -top-2 left-1 rounded-sm bg-primary px-2 py-1 text-xs font-light text-primary-content"
					>Your
				</span>
			{/if}
			{#if unpacking}
				<span
					class="absolute -bottom-3 left-1 rounded-sm border border-black bg-base-300 p-1 px-2 text-xs font-normal text-base-content"
					>Loading ...
				</span>
			{/if}
			<span
				class="absolute -bottom-2 right-1 rounded-sm border border-black bg-base-200 p-1 px-2 text-xs font-normal"
			>
				Fetch every

				<input
					bind:value={pollingInterval}
					class=" input-outline input-base-200 input input-xs w-8 appearance-none"
					type="number"
					min="3"
					max="99"
				/>
				s
			</span>
		</h1>
		<button class="py-auto btn btn-square btn-primary h-full w-fit" on:click={copyLink}>
			<span class="whitespace-nowrap px-4 py-6">
				{copied ? 'Link copied!' : 'Copy your link'}
			</span>
		</button>
	</div>

	<div class="flex flex-row items-center justify-center">
		<span class="p-2 text-sm">{profanityFilterEnabled ? 'Unblock' : 'Block'} Profanity :</span>
		<input
			type="checkbox"
			class="toggle toggle-sm"
			on:change={(e) => updateProf(e)}
			checked={profanityFilterEnabled}
		/>
	</div>

	<div class="flex w-full flex-col gap-3 p-4">
		{#if unlocked}
			{#each [...decryptedMessages].reverse() as msg (msg)}
				{@const color = generateConsistentIndices(msg.r)}
				<Message {msg} {color} />
			{/each}

			{#if !decryptedMessages.length}
				<span class="p-12"> No messages sent to your inbox yet </span>
			{/if}
		{/if}
	</div>
</div>

<style>
	/* Hide the up and down arrows in a number input field */
	input[type='number']::-webkit-inner-spin-button,
	input[type='number']::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	/* Firefox */
	input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}
</style>
