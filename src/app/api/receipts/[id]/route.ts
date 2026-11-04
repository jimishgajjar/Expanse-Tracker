import {getActiveWorkspace} from "@/lib/workspace";
import {getSession} from "@/lib/session";
import {getDb} from "@/lib/db";
import {merchantRulesEnabled} from "@/lib/merchant-rule-feature";
import {attachReceipt,maxReceiptBytes,normalizeReceipt,receiptBytes,ReceiptError,receiptInfo,receiptSignature,removeReceipt,validReceiptSignature} from "@/lib/receipt-images";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
const privateHeaders={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:privateHeaders});
async function handle(req:Request,ctx:Context){
  if(!merchantRulesEnabled())return json({error:"Unavailable."},404);
  const [ws,session,{id}]=await Promise.all([getActiveWorkspace(),getSession(),ctx.params]);
  if(!ws||!session)return json({error:"Sign in to view receipts."},401);
  const url=new URL(req.url),scope={workspace:ws.id,actor:session.user.id};
  if(req.method!=="GET"){
    const origin=req.headers.get("origin"),host=req.headers.get("host");
    if(!origin||!host||origin!=="http://"+host||!["owner","member"].includes(ws.role))return json({error:"Edit access required."},403);
  }
  const db=await getDb();
  try{
    if(req.method==="GET"){
      if(url.searchParams.has("file")){
        const file=url.searchParams.get("file")!,expires=Number(url.searchParams.get("expires"));
        if(!validReceiptSignature(session.sessionId,scope,id,file,expires,url.searchParams.get("sig")??""))return json({error:"Link expired or unavailable."},403);
        const data=await receiptBytes(db,scope,id,file);
        const disposition=url.searchParams.get("view")==="1"?"inline":"attachment";
        return data?new Response(new Uint8Array(data),{headers:{...privateHeaders,"Content-Type":"image/jpeg","Content-Disposition":disposition+'; filename="receipt.jpg"'}}):json({error:"Receipt unavailable."},404);
      }
      const info=await receiptInfo(db,scope,id);
      if(!info)return json({receipt:null});
      const expires=Date.now()+300000;
      const params=new URLSearchParams({file:info.id,expires:String(expires),sig:receiptSignature(session.sessionId,scope,id,info.id,expires)});
      return json({receipt:{...info,download:url.pathname+"?"+params}});
    }
    if(req.method==="DELETE"){
      await removeReceipt(db,scope,id,url.searchParams.get("file")??"");return json({ok:true});
    }
    if(await receiptInfo(db,scope,id))return json({error:"Remove the existing receipt before attaching another."},409);
    if(Number(req.headers.get("content-length"))>maxReceiptBytes)return json({error:"Choose a photo up to 5 MB."},413);
    const reader=req.body?.getReader();if(!reader)return json({error:"Select a photo."},400);
    const chunks:Uint8Array[]=[];let size=0;
    for(;;){
      const part=await reader.read();if(part.done)break;
      size+=part.value.length;
      if(size>maxReceiptBytes){await reader.cancel();return json({error:"Choose a photo up to 5 MB."},413);}
      chunks.push(part.value);
    }
    await attachReceipt(db,scope,id,await normalizeReceipt(Buffer.concat(chunks),req.headers.get("content-type")??""));
    return json({ok:true},201);
  }catch(e){return json({error:e instanceof ReceiptError?e.message:"Receipt request failed."},e instanceof ReceiptError?400:500);}
}
export {handle as GET,handle as POST,handle as DELETE};
