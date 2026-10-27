// Native lazy loading controls requests; this only softens the image's arrival.
const listeners = new WeakMap();
export const vImageReveal = {
  mounted(image) {
    const ready = () => { image.dataset.imageState = 'ready'; };
    image.dataset.imageState = image.complete ? 'ready' : 'pending';
    image.addEventListener('load', ready);
    image.addEventListener('error', ready);
    listeners.set(image, ready);
  },
  updated(image, binding) {
    if (binding.value !== binding.oldValue) {
      image.dataset.imageState = image.complete ? 'ready' : 'pending';
    }
  },
  unmounted(image) {
    const ready = listeners.get(image);
    image.removeEventListener('load', ready);
    image.removeEventListener('error', ready);
    listeners.delete(image);
  },
};
