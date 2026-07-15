<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import Input from '$lib/components/ui/input/input.svelte';
  import DownloadSimple from 'phosphor-svelte/lib/DownloadSimple';
  import UploadSimple from 'phosphor-svelte/lib/UploadSimple';
  import Warning from 'phosphor-svelte/lib/Warning';
  import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
  import { exportIdentities, importIdentities } from '$lib/utils/backup';

  interface Props {
    // Called after a successful import so the parent can refresh its list.
    onImported?: () => void;
  }
  let { onImported }: Props = $props();

  let exportOpen = $state(false);
  let importOpen = $state(false);

  let exportPassword = $state('');
  let exportError = $state('');

  let importPassword = $state('');
  let importFileText = $state('');
  let importFileName = $state('');
  let importError = $state('');
  let importResult = $state<{ added: number; total: number } | null>(null);

  const doExport = async () => {
    exportError = '';
    try {
      await exportIdentities(exportPassword || undefined);
      exportOpen = false;
      exportPassword = '';
    } catch (e) {
      exportError = e instanceof Error ? e.message : 'Export failed';
    }
  };

  const onFileChange = async (event: Event) => {
    importError = '';
    importResult = null;
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    importFileName = file.name;
    importFileText = await file.text();
  };

  const doImport = async () => {
    importError = '';
    if (!importFileText) {
      importError = 'Choose a backup file first';
      return;
    }
    try {
      importResult = await importIdentities(importFileText, importPassword || undefined);
      onImported?.();
    } catch (e) {
      importError = e instanceof Error ? e.message : 'Import failed';
    }
  };

  const resetImport = () => {
    importPassword = '';
    importFileText = '';
    importFileName = '';
    importError = '';
    importResult = null;
  };
</script>

<div class="flex flex-row gap-2">
  <Button variant="secondary" class="gap-2 text-sm" onclick={() => (exportOpen = true)}>
    <DownloadSimple weight="duotone" />
    Backup
  </Button>
  <Button
    variant="secondary"
    class="gap-2 text-sm"
    onclick={() => {
      resetImport();
      importOpen = true;
    }}
  >
    <UploadSimple weight="duotone" />
    Restore
  </Button>
</div>

<!-- Export -->
<Dialog.Root bind:open={exportOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Back up your identities</Dialog.Title>
      <Dialog.Description>
        Downloads all identities in this browser as a file. These contain your private keys — anyone
        with the file can read messages sent to you, so protect it with a password.
      </Dialog.Description>
    </Dialog.Header>

    <div class="flex flex-col gap-2 py-2">
      <label class="text-sm" for="backup-pw">Password (strongly recommended)</label>
      <Input
        id="backup-pw"
        type="password"
        bind:value={exportPassword}
        placeholder="Encrypt the backup file"
        autocomplete="new-password"
      />
      {#if !exportPassword}
        <span class="text-muted-foreground flex items-center gap-1 text-xs">
          <Warning weight="duotone" />
          Without a password the file holds your private keys in the clear.
        </span>
      {/if}
      {#if exportError}
        <span class="text-xs text-red-500">{exportError}</span>
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => (exportOpen = false)}>Cancel</Button>
      <Button onclick={doExport} class="gap-2">
        <DownloadSimple weight="duotone" />
        Download backup
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Import -->
<Dialog.Root bind:open={importOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Restore identities</Dialog.Title>
      <Dialog.Description>
        Adds identities from a backup file to this browser. Existing identities are kept, not
        overwritten.
      </Dialog.Description>
    </Dialog.Header>

    <div class="flex flex-col gap-3 py-2">
      <label
        class="border-primary hover:bg-muted flex cursor-pointer items-center justify-center gap-2 border border-dashed p-4 text-sm"
      >
        <UploadSimple weight="duotone" />
        {importFileName || 'Choose backup file'}
        <input type="file" accept="application/json,.json" class="hidden" onchange={onFileChange} />
      </label>

      <Input
        type="password"
        bind:value={importPassword}
        placeholder="Password (only if the backup is encrypted)"
        autocomplete="off"
      />

      {#if importError}
        <span class="text-xs text-red-500">{importError}</span>
      {/if}
      {#if importResult}
        <span class="flex items-center gap-1 text-xs text-green-600">
          <CheckCircle weight="duotone" />
          Added {importResult.added} new of {importResult.total} identities in the file.
        </span>
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={() => (importOpen = false)}>Close</Button>
      <Button onclick={doImport} class="gap-2">
        <UploadSimple weight="duotone" />
        Restore
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
