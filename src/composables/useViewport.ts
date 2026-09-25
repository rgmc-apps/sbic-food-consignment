import { ref, onMounted, onUnmounted } from 'vue';

/** Desktop starts where a mouse-and-keyboard, wide-monitor layout makes sense —
 *  deliberately above typical tablet width, since the tablet/phone warehouse
 *  experience (PRODUCT.md's primary persona) must stay exactly as designed. */
export const DESKTOP_BREAKPOINT = 1024;

export function useViewport() {
  const isDesktop = ref(typeof window !== 'undefined' ? window.innerWidth >= DESKTOP_BREAKPOINT : false);

  function update(): void {
    isDesktop.value = window.innerWidth >= DESKTOP_BREAKPOINT;
  }

  onMounted(() => window.addEventListener('resize', update));
  onUnmounted(() => window.removeEventListener('resize', update));

  return { isDesktop };
}
