import { expect, it } from "vitest";
import { householdNotificationLink } from "./notification-link";

const api = "https://synthetic.example/api/mobile";
it("keeps invitations and mention taps on the server configured for this build", () => {
  expect(householdNotificationLink("/?tab=settings",api)).toBe("https://synthetic.example/?tab=settings");
  expect(householdNotificationLink("/?tab=transactions&thread=rent&household=home",api))
    .toBe("https://synthetic.example/?tab=transactions&thread=rent&household=home");
  for (const path of ["https://outside.test/", "//outside.test", "/?tab=transactions&thread=rent", "/?tab=settings#anything"]) {
    expect(householdNotificationLink(path,api)).toBeNull();
  }
  expect(householdNotificationLink("/?tab=settings","http://untrusted.example/api/mobile")).toBeNull();
  expect(householdNotificationLink("/?tab=analytics&range=month&date=2026-10-01&redirect=evil",api))
    .toBe("https://synthetic.example/?tab=analytics&range=month&date=2026-10-01");
  expect(householdNotificationLink("/?tab=planning&redirect=evil",api)).toBe("https://synthetic.example/?tab=planning");
  expect(householdNotificationLink("/?tab=transactions",api)).toBe("https://synthetic.example/?tab=transactions");
});
