<script lang="ts">
  import Pause from 'phosphor-svelte/lib/Pause';
  import Play from 'phosphor-svelte/lib/Play';

  import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
  import Input from '$lib/components/ui/input/input.svelte';
  import { signedFetch } from '$lib/utils/signedRequest';
  import type { IRoomLimits } from '$lib/types';

  interface Props {
    rid: string;
    limits: IRoomLimits;
  }

  let { rid, limits = $bindable() }: Props = $props();

  // One signed action covers all four knobs; each control sends only the
  // field it owns and the server merges (see parseLimitsParams). Local state
  // is set from the response, not the optimistic value, same as VoiceToggle.
  const update = async (partial: Partial<IRoomLimits>) => {
    if (!rid) return;
    try {
      const resp = await signedFetch('/api/limits', 'PATCH', rid, 'limits:set', partial);
      if (resp.status !== 200) {
        console.error('Failed to update room limits:', resp.body);
      } else {
        limits = resp.body;
      }
    } catch (e) {
      console.error('Failed to update room limits', e);
    }
  };

  // A toggle-group click on the already-selected item emits '' (deselect);
  // none of these settings has a meaningful "nothing selected" state, so
  // treat that as a no-op rather than writing a surprise value.
  const LENGTH_PRESETS = [100, 280, 500];
  const RATE_PERIODS = ['minute', 'hour', 'day'];
  const MAX_RATE_COUNT = 10_000;

  // The count is typed, not toggled, so it commits on change (blur/Enter)
  // rather than per keystroke. Junk or out-of-range input is clamped to
  // something the server will accept instead of silently failing the PATCH.
  const commitRateCount = (raw: string) => {
    const n = Math.floor(Number(raw));
    const clamped = Number.isFinite(n) ? Math.min(Math.max(n, 0), MAX_RATE_COUNT) : 0;
    if (clamped !== limits.rateLimitCount) update({ rateLimitCount: clamped });
  };
</script>

<hr />
<h3 class="text-sm">Abuse limits</h3>

<div class="flex flex-col gap-3">
  <div class="flex flex-col gap-1">
    <span class="text-muted-foreground text-xs">
      Pause the room. Nobody can send anything until you resume.
    </span>
    <ToggleGroup.Root
      type="single"
      value={limits.paused ? 'paused' : 'open'}
      onValueChange={(value) => {
        if (value) update({ paused: value === 'paused' });
      }}
    >
      <ToggleGroup.Item
        value="open"
        class="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        <Play size={20} weight="duotone" color="currentColor" />
        <p>Accepting</p>
      </ToggleGroup.Item>
      <ToggleGroup.Item
        value="paused"
        class="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        <Pause size={20} weight="duotone" color="currentColor" />
        <p>Paused</p>
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  </div>

  <div class="flex flex-col gap-1">
    <span class="text-muted-foreground text-xs">
      Cap message length (characters). Off means the default 1000.
    </span>
    <ToggleGroup.Root
      type="single"
      value={limits.maxMessageLength > 0 ? String(limits.maxMessageLength) : 'off'}
      onValueChange={(value) => {
        if (value) update({ maxMessageLength: value === 'off' ? 0 : Number(value) });
      }}
    >
      <ToggleGroup.Item
        value="off"
        class="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        <p>Off</p>
      </ToggleGroup.Item>
      {#each LENGTH_PRESETS as preset (preset)}
        <ToggleGroup.Item
          value={String(preset)}
          class="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <p>{preset}</p>
        </ToggleGroup.Item>
      {/each}
    </ToggleGroup.Root>
  </div>

  <div class="flex flex-col gap-1">
    <span class="text-muted-foreground text-xs">
      Cap how many messages this room accepts, across all senders. 0 means no cap.
    </span>
    <div class="flex flex-wrap items-center gap-2">
      <Input
        type="number"
        min="0"
        max={MAX_RATE_COUNT}
        step="1"
        class="w-24"
        value={limits.rateLimitCount}
        onchange={(e: Event) => commitRateCount((e.currentTarget as HTMLInputElement).value)}
      />
      <span class="text-muted-foreground text-sm">per</span>
      <ToggleGroup.Root
        type="single"
        value={limits.rateLimitPeriod}
        onValueChange={(value) => {
          if (value) update({ rateLimitPeriod: value });
        }}
      >
        {#each RATE_PERIODS as period (period)}
          <ToggleGroup.Item
            value={period}
            class="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            <p>{period}</p>
          </ToggleGroup.Item>
        {/each}
      </ToggleGroup.Root>
    </div>
  </div>
</div>
