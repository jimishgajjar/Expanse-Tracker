import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { fields, type Entry, type Mapping, type Source } from "./file-import-model";
import { decimalMoney,moneyCents,statementDate } from "./statement-review";

export class ImportProblem extends Error {}
const fail=(message:string):never=>{throw new ImportProblem(message);};
const special="\u0000unsupported-cell";
export const MAX_FILE=512*1024, MAX_ROWS=300;
function csv(text:string) {
  const records:string[][]=[];let row:string[]=[], cell="",quoted=false,closed=false;
  function field(){row.push(cell);cell="";closed=false;if(row.length>40)fail("Use at most 40 columns.");}
  function record(){field();records.push(row);row=[];if(records.length>MAX_ROWS+1)fail("Use at most 300 rows per file.");}
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){if(ch!=='"')cell+=ch;else if(text[i+1]==='"'){cell+='"';i++;}else {quoted=false;closed=true;}}
    else if(ch===",")field();
    else if(ch==="\n"||ch==="\r"){if(ch==="\r"&&text[i+1]==="\n")i++;record();}
    else if(ch==='"'&&!cell&&!closed)quoted=true;
    else if(closed||ch==='"')fail("Invalid CSV quoting. Export a comma-separated UTF-8 file.");
    else cell+=ch;
  }
  if(quoted)fail("A quoted CSV field is incomplete.");
  if(row.length||cell||closed)record();
  return records;
}
// Bound the *actual* inflated content before letting ExcelJS load an XLSX archive.
function boundedZip(buf:Buffer) {
  const end=buf.lastIndexOf(Buffer.from([80,75,5,6]));
  if(end<0||end+22>buf.length)fail("Invalid XLSX archive.");
  const count=buf.readUInt16LE(end+10);let at=buf.readUInt32LE(end+16),remaining=8*1024*1024;
  if(!count||count>200||buf.readUInt16LE(end+4)||buf.readUInt16LE(end+6))fail("Workbook is too large or unsupported.");
  for(let i=0;i<count;i++){
    if(at+46>end||buf.readUInt32LE(at)!==0x02014b50)fail("Invalid workbook directory.");
    const method=buf.readUInt16LE(at+10),size=buf.readUInt32LE(at+20),local=buf.readUInt32LE(at+42);
    if(buf.readUInt16LE(at+8)&1||local+30>at||buf.readUInt32LE(local)!==0x04034b50)fail("Encrypted or invalid workbook.");
    const start=local+30+buf.readUInt16LE(local+26)+buf.readUInt16LE(local+28);
    if(start+size>at||remaining<=0||buf.readUInt32LE(at+24)>remaining)fail("Workbook exceeds the expanded size limit.");
    const data=buf.subarray(start,start+size);
    if(method===0)remaining-=size;
    else if(method===8)remaining-=inflateRawSync(data,{maxOutputLength:remaining}).length;
    else fail("Unsupported workbook compression.");
    at+=46+buf.readUInt16LE(at+28)+buf.readUInt16LE(at+30)+buf.readUInt16LE(at+32);
  }
  if(at!==end||remaining<0)fail("Invalid or oversized workbook.");
}
export async function parseSource(file:File):Promise<Source>{
  if(!file||typeof file.arrayBuffer!=="function"||!file.size||file.size>MAX_FILE)fail("Choose a CSV or XLSX file up to 512 KB.");
  const buf=Buffer.from(await file.arrayBuffer());
  let records:{line:number;cells:string[]}[]=[];
  if(/\.xlsx$/i.test(file.name)){
    try {boundedZip(buf);const {default:ExcelJS}=await import("exceljs");const wb=new ExcelJS.Workbook();
      await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
      const sheet=wb.getWorksheet("Transactions")??(wb.worksheets.length===1?wb.worksheets[0]:null);
      if(!sheet)fail("Name the transaction sheet Transactions, or use a single-sheet workbook.");
      if(sheet!.rowCount>MAX_ROWS+1||sheet!.columnCount>40)fail("Use at most 300 rows and 40 columns.");
      sheet!.eachRow((r,line)=>records.push({line,cells:Array.from({length:r.cellCount},(_,idx)=>{
        const v=r.getCell(idx+1).value;
        return v==null?"":v instanceof Date?v.toISOString().slice(0,10):typeof v==="string"||typeof v==="number"?String(v):special;
      })}));
    }catch(e){if(e instanceof ImportProblem)throw e;fail("Cannot read this workbook. Use a smaller plain XLSX file.");}
  }else if(/\.csv$/i.test(file.name)){
    let content="";try{content=new TextDecoder("utf-8",{fatal:true}).decode(buf);}catch{fail("CSV must use UTF-8 encoding.");}
    if(content.includes("\u0000"))fail("Invalid CSV text.");
    records=csv(content).map((cells,i)=>({line:i+1,cells}));
  }else fail("Choose a .csv or .xlsx file.");
  const headers=records.shift()?.cells.map(h=>h.trim())??[];
  if(!headers.length||headers.some(h=>!h||h.includes("\u0000")||h.length>120))fail("Use a named header for each column.");
  const lines=records.filter(r=>r.cells.some(v=>v.trim()));
  if(!lines.length)fail("No transaction rows found.");
  return {hash:createHash("sha256").update(buf).digest("hex"),filename:file.name.slice(0,180),headers,lines};
}
type Ref={id:string;name:string};
export function normalize(source:Source,m:Mapping,currency:string,accounts:Ref[],categories:(Ref&{kind:string})[]):Entry[] {
  const indexes=fields.map(f=>m[f]);
  if(!["ISO","DMY","MDY"].includes(m.dateOrder)||m.date<0||m.amount<0||indexes.some(i=>!Number.isInteger(i)||i < -1||i>=source.headers.length)||new Set(indexes.filter(i=>i>=0)).size!==indexes.filter(i=>i>=0).length)fail("Map Date and Amount, and use each column only once.");
  const group=new Map<string,Entry[]>();
  const rows=source.lines.map(({line,cells})=>{
    const get=(f:typeof fields[number])=>{const cell=cells[m[f]]??"";return cell.includes("\u0000")?"":cell.trim();},errors:string[]=[];
    if(cells.length>source.headers.length||cells.some(c=>c.includes("\u0000")||c.length>500))errors.push("Extra columns, unsupported cells, or text over 500 characters.");
    let date=get("date"),amount=get("amount"),type=get("type").toLowerCase();
    if(m.dateOrder!=="ISO"&&!/^\d{4}-/.test(date)){const parts=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(date);
      if(parts){const [,a,b,y]=parts;date=[y,(m.dateOrder==="DMY"?b:a).padStart(2,"0"),(m.dateOrder==="DMY"?a:b).padStart(2,"0")].join("-");}}
    if(!statementDate.safeParse(date).success)errors.push("Invalid date for the chosen format.");
    if(!/^-?\d{1,12}(\.\d{1,2})?$/.test(amount)||Number(amount)===0)errors.push("Use a non-zero decimal amount (up to two decimal places).");
    else {if(m.type<0)type=amount.startsWith("-")?"expense":"income";
      else if(amount.startsWith("-")&&type!=="expense")errors.push("Negative amount conflicts with its type.");
      amount=decimalMoney(moneyCents(amount.replace(/^-/,"")));}
    if(type!=="income"&&type!=="expense")errors.push("Only income and expense rows can be imported.");
    if(m.currency>=0&&get("currency").toUpperCase()!==currency)errors.push("Currency does not match "+currency+".");
    const account=get("account"),category=get("category");
    const aa=account?accounts.filter(a=>a.name.toLowerCase()===account.toLowerCase()):accounts.filter(a=>a.id===m.fallback);
    if(aa.length!==1)errors.push("Choose an existing active account; account missing or ambiguous.");
    const cc=category&&!/^uncategorised$|^uncategorized$/i.test(category)?categories.filter(c=>c.kind===type&&c.name.toLowerCase()===category.toLowerCase()):[];
    if(category&&!/^uncategorised$|^uncategorized$/i.test(category)&&cc.length!==1)errors.push("Category does not identify one existing category of this type.");
    const row:Entry={line,date:date.slice(0,32),amount:amount.slice(0,32),type:type.slice(0,32),note:get("note").slice(0,500),account:aa[0]?.name??account.slice(0,120),category:category.slice(0,120),accountId:aa[0]?.id??null,categoryId:cc[0]?.id??null,errors,candidates:[],repeated:false};
    if(!errors.length){const k=JSON.stringify([date,type,amount,row.accountId]);const matches=group.get(k)??[];matches.push(row);group.set(k,matches);}
    return row;
  });
  for(const matches of group.values())if(matches.length>1)for(const row of matches)row.repeated=true;
  return rows;
}
