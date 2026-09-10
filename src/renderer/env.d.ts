import type { GrokApi } from "../preload/index";

declare global {
  interface Window {
    grok: GrokApi;
  }
}

export {};
