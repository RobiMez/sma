import MessageFeedback from '../_components/MessageFeedback.svelte';
import { mount, unmount } from "svelte";

// Break a long string into some max length array of strings
export function breakString(str: string, maxLength: number) {
  const parts = [];
  for (let i = 0; i < str.length; i += maxLength) {
    parts.push(str.substring(i, i + maxLength));
  }
  return parts;
}

// show feedback on the given component
export function showMessageFeedback(
  variant: 'error' | 'default',
  message: string,
  containerId: string
) {
  // Dynamically create a div element to mount the MessageFeedback component
  const container = document.getElementById(containerId);

  // Check if the container element exists
  if (!container) {
    console.error(`Feedback container with ID '${containerId}' not found.`);
    return; // Stop the operation if container is not found
  }

  // Mount the MessageFeedback component to the container
  const feedback = mount(MessageFeedback, {
      target: container,
      props: { variant, message }
    });

  // Remove the dynamically created div from the DOM after a delay (optional)
  setTimeout(() => {
    unmount(feedback);
  }, 5000); // Remove after 5 seconds (adjust as needed)
}
