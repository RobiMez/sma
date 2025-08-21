<script lang="ts">
  interface Props {
    variant?: 'error' | 'default';
    message?: string;
  }

  let { variant = 'error', message = 'This is the message' }: Props = $props();
</script>

<span class={`${variant == 'error' ? 'text-error' : 'text-xl font-light'}`}>{message}</span>
