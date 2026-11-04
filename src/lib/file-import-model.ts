export const fields = ["date","amount","type","note","account","category","currency"] as const;
export type Field = typeof fields[number];
export type Mapping = Record<Field,number> & {dateOrder:"ISO"|"DMY"|"MDY"; fallback:string};
export type Source = {hash:string;filename:string;headers:string[];lines:{line:number;cells:string[]}[]};
export type Candidate = {id:string;note:string};
export type Entry = {line:number;date:string;type:string;amount:string;note:string;account:string;category:string;accountId:string|null;categoryId:string|null;errors:string[];cutoff?:string;candidates:Candidate[];repeated:boolean};
export type Outcome = {line:number;action:"import"|"ignore"|"match";transactionId:string|null};
export type Batch = {id:string;filename:string;fileHash:string;currency:string;version:number;rows:Entry[];receipt:Outcome[]|null};
export const fileImportsEnabled = () => process.env.REVIEWED_FILE_IMPORTS === "1";
export const defaultMapping=(headers:string[]):Mapping=>({
  ...Object.fromEntries(fields.map(key=>[key,headers.findIndex(h=>h.trim().toLowerCase()===key)])) as Record<Field,number>,
  dateOrder:"ISO",fallback:"",
});
