<script lang="ts">
  export let pollingInterval: number;
  export let onIntervalChange: (newInterval: number) => void;

  $: {
    if (pollingInterval < 3) pollingInterval = 3;
    onIntervalChange(pollingInterval);
  }
</script>

<span
  class="absolute -bottom-2 right-1 rounded-sm bg-light-200 p-1 px-2 text-xs font-normal text-light-900 dark:bg-dark-800 dark:text-dark-200"
>
  Fetch every
  <input
    bind:value={pollingInterval}
    class="input-outline w-8 appearance-none bg-dark-content dark:bg-light-content"
    type="number"
    min="3"
    max="99"
  />
  s
</span>

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
