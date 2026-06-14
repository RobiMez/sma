<script lang="ts">
  interface Token {
    type: 'word' | 'space';
    value: string;
    index?: number;
    key: string;
  }

  interface Props {
    text: string;
    redactMode?: boolean;
    showHighlights?: boolean;
    redactedIndices: Set<number>;
    onWordClick?: (index: number) => void;
  }

  let {
    text,
    redactMode = false,
    showHighlights = false,
    redactedIndices,
    onWordClick
  }: Props = $props();

  function parseTokens(message: string): Token[] {
    const result: Token[] = [];
    const regex = /(\S+)|(\s+)/g;
    let wordIndex = 0;
    let tokenIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(message)) !== null) {
      if (match[1]) {
        result.push({
          type: 'word',
          value: match[1],
          index: wordIndex++,
          key: `word-${tokenIndex++}`
        });
      } else if (match[2]) {
        result.push({
          type: 'space',
          value: match[2],
          key: `space-${tokenIndex++}`
        });
      }
    }

    return result;
  }

  const tokens = $derived(parseTokens(text));
</script>

<span class="w-full min-w-0 break-words text-left">
  {#each tokens as token (token.key)}
    {#if token.type === 'space'}
      {token.value}
    {:else}
      {@const index = token.index!}
      {@const isRedacted = redactedIndices.has(index)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <span
        class="inline transition-all duration-150
          {isRedacted
          ? 'rounded-[3px] bg-black px-[3px] text-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] select-none'
          : showHighlights && redactMode
            ? 'cursor-pointer rounded-[3px] bg-yellow-300/45 ring-1 ring-yellow-500/30 hover:bg-yellow-400/55 dark:bg-yellow-500/25 dark:ring-yellow-400/20 dark:hover:bg-yellow-500/40'
            : ''}"
        onclick={() => {
          if (redactMode && onWordClick) onWordClick(index);
        }}
      >
        {token.value}
      </span>
    {/if}
  {/each}
</span>
