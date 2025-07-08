import { ref, onMounted, onUnmounted } from "vue";

export function useIsMobile() {
  const isMobile = ref(window.innerWidth <= 480);

  const update = () => {
    isMobile.value = window.innerWidth <= 480;
  };

  onMounted(() => {
    window.addEventListener("resize", update);
  });

  onUnmounted(() => {
    window.removeEventListener("resize", update);
  });

  return { isMobile };
}
