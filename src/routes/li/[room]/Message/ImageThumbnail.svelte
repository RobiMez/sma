<script lang="ts">
  import { v4 as uuid } from 'uuid';
  interface Props {
    imageBase64: string;
    variant?: 'sm' | 'md';
  }

  let { imageBase64, variant = 'sm' }: Props = $props();

  const id: string = `image_modal_${uuid()}`;

  const toggleModal = () => {
    let modal: HTMLDialogElement = document.getElementById(id) as HTMLDialogElement;
    modal.showModal();
  };
</script>

<div>
  <button
    class={`${variant == 'md' ? 'w-48' : 'w-24'} border-black rounded-xs border`}
    onclick={toggleModal}
  >
    <img src={imageBase64} alt="Lorem" />
  </button>
  <dialog {id} class="modal modal-bottom sm:modal-middle items-center">
    <div class="modal-box flex items-center justify-center">
      <img src={imageBase64} alt="Lorem" />
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</div>
