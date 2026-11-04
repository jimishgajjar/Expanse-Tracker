import { expect, it, vi } from "vitest";
import { listenForHouseholdTaps } from "./push";

const mock=vi.hoisted(()=>({
  open:vi.fn<(url:string)=>Promise<void>>().mockResolvedValue(undefined),
  clear:vi.fn(), remove:vi.fn(), listen:vi.fn(), last:vi.fn(),
}));
vi.mock("expo-constants",()=>({default:{executionEnvironment:"standalone"},ExecutionEnvironment:{StoreClient:"expo-go"}}));
vi.mock("react-native",()=>({Linking:{openURL:mock.open},Platform:{OS:"ios"},AppState:{currentState:"active"}}));
vi.mock("./api",()=>({apiBase:()=>"https://staging.example/api/mobile",bindApi:vi.fn()}));
vi.mock("./auth",()=>({useAuth:{getState:vi.fn()}}));
vi.mock("expo-notifications",()=>({getLastNotificationResponse:mock.last,clearLastNotificationResponse:mock.clear,
  addNotificationResponseReceivedListener:mock.listen,DEFAULT_ACTION_IDENTIFIER:"tap"}));

it("opens a cold-start mention once and handles a subsequent invitation tap",async()=>{
  const event=(id:string,url:string)=>({actionIdentifier:"tap",notification:{request:{identifier:id,content:{data:{url}}}}});
  const mention=event("first","/?tab=transactions&thread=rent&household=home");
  mock.last.mockReturnValue(mention);
  mock.listen.mockReturnValue({remove:mock.remove});
  const stop=listenForHouseholdTaps();
  try {
    await vi.waitFor(()=>expect(mock.open).toHaveBeenCalledTimes(1));
    const listener=mock.listen.mock.calls[0][0];
    listener(mention);
    listener(event("untrusted","https://outside.example"));
    listener(event("second","/?tab=settings"));
    expect(mock.open.mock.calls.map(([url])=>url)).toEqual([
      "https://staging.example/?tab=transactions&thread=rent&household=home","https://staging.example/?tab=settings",
    ]);
  } finally {stop();}
  expect(mock.remove).toHaveBeenCalledOnce();
});

it("passes the originating tracker to the unlocked navigation handler",async()=>{
  mock.last.mockReturnValue(null);
  mock.listen.mockClear();
  const open=vi.fn(async()=>{});
  const stop=listenForHouseholdTaps(open);
  try {
    await vi.waitFor(()=>expect(mock.listen).toHaveBeenCalledOnce());
    mock.listen.mock.calls[0][0]({actionIdentifier:"tap",notification:{request:{identifier:"budget",
      content:{data:{url:"/?tab=analytics",workspace:"synthetic-household"}}}}});
    expect(open).toHaveBeenCalledWith("https://staging.example/?tab=analytics","synthetic-household");
  } finally {stop();}
});
