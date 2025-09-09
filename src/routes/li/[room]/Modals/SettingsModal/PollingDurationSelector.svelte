<script lang="ts">
  import Input from '$lib/components/ui/input/input.svelte';

  interface Props {
    pollingInterval: number;
    onIntervalChange: (newInterval: number) => void;
  }

  let { pollingInterval = $bindable(), onIntervalChange }: Props = $props();

  $effect(() => {
    onIntervalChange(pollingInterval);
  });
</script>

<hr />
<h3 class="text-sm">Refresh interval</h3>

<span class="text-xs">
  <Input bind:value={pollingInterval} type="number" min="3" max="99" />
  <p>How often the site should refresh for new messages , in seconds. minimum 3 seconds.</p>
</span>
