import "vue";

declare module "@vue/runtime-core" {
  interface AppConfig {
    devtools?: boolean;
  }
}
