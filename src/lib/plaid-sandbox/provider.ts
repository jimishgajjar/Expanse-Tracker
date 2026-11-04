import { z } from "zod";

const id = z.string().min(1);
const link = z.object({ link_token: z.string().startsWith("link-sandbox-") });
const transaction = z.object({
  name:z.string().optional(),
  transaction_id: id, account_id: id, date: z.iso.date(), amount: z.number(),
  iso_currency_code: z.string().nullable(), pending: z.boolean(),
  pending_transaction_id: id.nullable(),
});
const page = z.object({
  added: z.array(transaction), modified: z.array(transaction),
  removed: z.array(z.object({ transaction_id: id, account_id: id.optional() })),
  has_more: z.boolean(), next_cursor: z.string(),
  transactions_update_status: z.enum(["NOT_READY","INITIAL_UPDATE_COMPLETE","HISTORICAL_UPDATE_COMPLETE","TRANSACTIONS_UPDATE_STATUS_UNKNOWN"]),
});
export type SandboxPage = z.infer<typeof page>;
export type Observation = SandboxPage["added"][number];

// Safe to print: arbitrary provider messages, request bodies and tokens never
// enter an error message. There is deliberately no configurable host.
export class SandboxError extends Error {}
const knownCodes = new Set(["TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION","PRODUCT_NOT_READY",
  "ITEM_LOGIN_REQUIRED","INVALID_API_KEYS","INVALID_ACCESS_TOKEN","RATE_LIMIT_EXCEEDED"]);

export class SandboxProvider {
  constructor(private readonly credentials:{clientId:string;secret:string}, private readonly send:typeof fetch=fetch) {}
  private async post<T>(path:string,body:Record<string,unknown>,schema:z.ZodType<T>):Promise<T> {
    let response:Response, payload:unknown;
    try {
      response=await this.send("https://sandbox.plaid.com"+path,{
        method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000),
        headers:{"Content-Type":"application/json","Plaid-Version":"2020-09-14",
          "PLAID-CLIENT-ID":this.credentials.clientId,"PLAID-SECRET":this.credentials.secret},
        body:JSON.stringify(body),
      });
      payload=await response.json();
    } catch { throw new SandboxError("NETWORK_OR_RESPONSE_ERROR"); }
    if(!response.ok){
      const code=z.object({error_code:z.string()}).safeParse(payload);
      throw new SandboxError(code.success&&knownCodes.has(code.data.error_code)?code.data.error_code:"PROVIDER_HTTP_"+response.status);
    }
    const validated=schema.safeParse(payload);
    if(!validated.success)throw new SandboxError("UNEXPECTED_PROVIDER_RESPONSE");
    return validated.data;
  }
  createLink(userId:string,accessToken?:string) {
    return this.post("/link/token/create",{client_name:"Expense Tracker Sandbox",language:"en",country_codes:["CA"],
      user:{client_user_id:userId},...(accessToken?{access_token:accessToken}:{products:["transactions"]})},link);
  }
  createTestItem() {
    return this.post("/sandbox/public_token/create",{institution_id:"ins_109508",initial_products:["transactions"],
      options:{override_username:"user_transactions_dynamic",override_password:"sandbox-test"}},
      z.object({public_token:z.string().startsWith("public-sandbox-")}));
  }
  exchange(publicToken:string) {
    return this.post("/item/public_token/exchange",{public_token:publicToken},
      z.object({access_token:z.string().startsWith("access-sandbox-"),item_id:id}));
  }
  accounts(accessToken:string) {
    return this.post("/accounts/get",{access_token:accessToken},z.object({
      accounts:z.array(z.object({account_id:id,name:z.string().optional(),type:id,subtype:z.string().nullable()})),item:z.object({item_id:id}),
    }));
  }
  sync(accessToken:string,accountId:string,cursor:string|null) {
    return this.post("/transactions/sync",{access_token:accessToken,options:{account_id:accountId},count:10,
      ...(cursor?{cursor}:{})},page);
  }
  remove(accessToken:string) {
    return this.post("/item/remove",{access_token:accessToken},z.object({request_id:id}));
  }
}
