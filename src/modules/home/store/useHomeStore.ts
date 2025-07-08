import { defineStore } from "pinia";

export const useHomeStore = defineStore("home", {
  state: () => ({
    welcomeMessage: "Bienvenido a Home",
  }),
  actions: {
    updateMessage(newMsg: string) {
      this.welcomeMessage = newMsg;
    },
  },
});
