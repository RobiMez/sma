<script lang="ts">
	import { decode } from "blurhash";
	import { onMount } from "svelte";
    export let blurhash = '';
    export let imageId = '';
    export let variant: 'sm' | 'md' = 'sm';



    let modal: HTMLDialogElement;
    let pixels: any;
    let canvas: HTMLCanvasElement;
    let imageBase64 = '';
					
    const toggleModal = async () => {
        modal.showModal()
        // If modal is open load the image
        if(modal.open){
            // Fetch the image from the db
            const response = await fetch(`/api/images?id=${imageId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
    
            // Parse the JSON response
            const resp = await response.json();
    
            // If there's an error in the response, log the message
            if (resp.error) {
                console.log(resp.message);
            } else {
                imageBase64 = resp.body.dataURI.join("")
            }
        }

    }

    onMount(()=>{
        function pixelsToDataURL(pixels: Uint8ClampedArray): string {
            const ctx = canvas.getContext("2d");
            canvas.width = 120;
            canvas.height = 90;
            const imageData = new ImageData(pixels, 120, 90);
            ctx?.putImageData(imageData, 0, 0);
            return canvas.toDataURL("image/png");
        }
        pixels = decode(blurhash, 120, 90 );
        pixelsToDataURL(pixels)
    })

</script>


<div>
    <button class={`${variant == 'md' ? 'w-48' : 'w-24'} rounded-sm border border-black`} on:click={toggleModal}>
        <canvas bind:this={canvas}></canvas>
    </button>
    <dialog bind:this={modal} class="modal modal-bottom sm:modal-middle items-center">
      <div class="modal-box flex items-center justify-center">
        {#if imageBase64}
            <img src={imageBase64} alt="Image to view..." />
        {:else}
            <div class="loader"></div>
        {/if}
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
    </dialog>
</div>
