<script lang="ts">
  import { onMount } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  interface Stats {
    activeUsers: number;
    identities: number;
    totalMessages: number;
  }

  let statsLoaded = false;

  const activeUsers = tweened(0, { duration: 2000, easing: cubicOut });
  const identities = tweened(0, { duration: 2000, easing: cubicOut });
  const totalMessages = tweened(0, { duration: 2000, easing: cubicOut });

  let stats: Stats = { activeUsers: 0, identities: 0, totalMessages: 0 };

  onMount(async () => {
    const response = await fetch(`/api/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const resp = await response.json();

    if (resp.error) {
      stats = { activeUsers: 0, identities: 0, totalMessages: 0 };
    } else {
      stats = resp.body;
      statsLoaded = true;

      $activeUsers = stats.activeUsers;
      $identities = stats.identities;
      $totalMessages = stats.totalMessages;
    }
  });
</script>

{#if statsLoaded}
  <small in:fade class="text-primary/80 text-sm font-normal">
    <b>{Math.round($activeUsers) ?? ''}</b>
    {stats.activeUsers != 1 ? 'Active users' : 'Active user'} ,
    <b>{Math.round($identities)}</b>
    {stats.identities != 1 ? 'Identities' : 'Identity'} ,
    <b>{Math.round($totalMessages)}</b>
    {stats.totalMessages != 1 ? 'Msgs' : 'Msg'} and counting...
  </small>
{:else}
  <small class="text-primary text-sm font-light"> Loading Stats... </small>
{/if}
