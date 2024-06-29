
import colors from '$lib/utils/colors.json';

export const generateConsistentIndices = (input: string) => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  const index1 = Math.abs(hash % 992);
  const index2 = Math.abs(hash % 5);

  return colors[index1][index2];
};