import { SCOPE_CHECK_PATH, VIEW_HEADER } from "./lib/tracker-view";

// Server Actions use Next's own fetch transport. Bind those and our API
// requests to the signed-in document before hydration can submit any form.
const transport = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.href);
  if (url.origin !== location.origin || url.pathname === SCOPE_CHECK_PATH) return transport(input, init);
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (!headers.has("next-action") && !headers.has("rsc") && !url.pathname.startsWith("/api/")) return transport(input, init);
  const view = document.querySelector<HTMLElement>("[data-tracker-view]")?.dataset.trackerView;
  if (!view) return transport(input, init);
  const original = document.documentElement.dataset.trackerDocument;
  if (original && original !== view) {
    window.location.reload();
    return Promise.reject(new Error("The signed-in tracker changed."));
  }
  document.documentElement.dataset.trackerDocument = view;
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  if (method !== "GET" && document.documentElement.hasAttribute("data-tracker-locked")) {
    return Promise.reject(new Error("Reopen the tracker before continuing."));
  }
  headers.set(VIEW_HEADER, view);
  return transport(input, { ...init, headers });
};
