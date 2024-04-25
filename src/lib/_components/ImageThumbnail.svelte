<script lang="ts">
    import { v4 as uuid } from "uuid"
    export let imageBase64 : string;
    export let variant: 'sm' | 'md' = 'sm';

    const id: string = `image_modal_${uuid()}`;
					
    const toggleModal = () => {
        let modal : HTMLDialogElement = document.getElementById(id) as HTMLDialogElement;
        modal.showModal()
    }

</script>
<div>
    <button class={`${variant == 'md' ? 'w-48' : 'w-24'} rounded-sm border border-black`} on:click={toggleModal}>
        <img src={imageBase64} alt="Image to send..." />
    </button>
    <dialog id={id} class="modal modal-bottom sm:modal-middle items-center">
      <div class="modal-box flex items-center justify-center">
        <img src={imageBase64} alt="Image to send..." />
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
    </dialog>
</div>