<script lang="ts">
    export let variant : 'error' | 'default' = 'error';
    export let message = 'This is the message';
</script>

<span class={`${variant == 'error' ? 'text-error' : 'text-xl font-light'}`}>{message}</span>
