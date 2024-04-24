<script lang="ts">
    export let imageBase64 : string;
					
    const toggleModal = () => {
        let modal : HTMLDialogElement = document.getElementById('image_modal') as HTMLDialogElement;
        modal.showModal()
    }

</script>
<div>
    <button class="w-48 rounded-sm border border-black" on:click={toggleModal}>
        <img src={imageBase64} alt="Image to send..." />
    </button>
    <dialog id="image_modal" class="modal modal-bottom sm:modal-middle">
      <div class="modal-box">
        <img src={imageBase64} alt="Image to send..." />
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
    </dialog>
</div>