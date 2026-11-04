import { expect, it, vi } from "vitest";
import { hostedHouseholdEnabled, sameHouseholdOrigin } from "../household-features";
import { merchantRulesEnabled } from "../merchant-rule-feature";
import { pilotAvailable } from "../pilot-release";

it("only opens production planning and setup when their release requirements are present",()=>{
  try {
    vi.stubEnv("VERCEL_ENV","production");
    vi.stubEnv("DATABASE_URL","postgresql://example.neon.tech/neondb");
    vi.stubEnv("PILOT_SETUP","1");
    vi.stubEnv("REVIEWED_FILE_IMPORTS","1");
    vi.stubEnv("STATEMENT_REVIEWS_ENABLED","1");
    vi.stubEnv("HOUSEHOLD_RELEASE","");
    expect(merchantRulesEnabled()).toBe(false);
    expect(pilotAvailable()).toBe(false);
    vi.stubEnv("HOUSEHOLD_RELEASE","production");
    expect(merchantRulesEnabled()).toBe(true);
    expect(pilotAvailable()).toBe(true);
    vi.stubEnv("REVIEWED_FILE_IMPORTS","0");
    expect(pilotAvailable()).toBe(false);
    vi.stubEnv("VERCEL_ENV","preview");
    expect(merchantRulesEnabled()).toBe(false);
  } finally { vi.unstubAllEnvs(); }
});

it("keeps rehearsal features off on normal databases and requires a separate production switch",()=>{
  const db="postgresql://test@example.neon.tech/m7_rehearsal_"+"1".repeat(32);
  const env={NODE_ENV:"production" as const,HOUSEHOLD_RELEASE:"staging",VERCEL_ENV:"preview",DATABASE_URL:db};
  expect(hostedHouseholdEnabled(env)).toBe(true);
  expect(hostedHouseholdEnabled({...env,DATABASE_URL:"postgresql://test@example.neon.tech/neondb"})).toBe(false);
  expect(hostedHouseholdEnabled({...env,HOUSEHOLD_RELEASE:"production"})).toBe(false);
  expect(hostedHouseholdEnabled({...env,VERCEL_ENV:"production"})).toBe(false);
});

it("admits same-origin HTTPS mutations and rejects missing, downgraded or forged origins",()=>{
  const url="https://tracker.example/api/transaction-comments/1";
  const request=(origin:string,host="tracker.example")=>new Request(url,{headers:{host,origin}});
  expect(sameHouseholdOrigin(request("https://tracker.example"))).toBe(true);
  for (const origin of ["","null","https://other.example","http://tracker.example"])
    expect(sameHouseholdOrigin(request(origin))).toBe(false);
  expect(sameHouseholdOrigin(request("https://other.example","other.example"))).toBe(false);
});
