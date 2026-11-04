import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";
import { commentLink } from "../comment-link";

it("retains only the intended Activity conversation through a sign-in or tracker switch", () => {
  const link = commentLink("entry&tab=accounts","home");
  const url = new URL(link!, "https://example.test");
  expect([...url.searchParams]).toEqual([["tab","transactions"],["thread","entry&tab=accounts"],["household","home"]]);
  expect(commentLink(undefined,"home")).toBeNull();
  expect(commentLink("entry",["home","away"])).toBeNull();
});

it("opens a mention without replacing an unrelated tab and keeps notification clicks on the app origin", async () => {
  const origin = "https://example.test";
  const url = origin + commentLink("rent","home");
  const focus = vi.fn();
  const openWindow = vi.fn();
  const handlers = new Map();
  const clients = { matchAll: async () => [{url,focus}], openWindow };
  runInNewContext(readFileSync("public/sw.js","utf8"), {
    URL, self:{location:{origin}, clients, addEventListener:handlers.set.bind(handlers)},
  });
  async function click(target: string) {
    let completion:Promise<void> | undefined;
    handlers.get("notificationclick")({notification:{data:{url:target},close(){}},waitUntil(p:Promise<void>){completion=p;}});
    await completion;
  }
  await click(url);
  expect(focus).toHaveBeenCalledOnce();
  expect(openWindow).not.toHaveBeenCalled();
  await click(commentLink("food","home")!);
  expect(openWindow).toHaveBeenLastCalledWith(origin + commentLink("food","home"));
  await click("https://external.example/redirect");
  expect(openWindow).toHaveBeenLastCalledWith(origin + "/");
});
