import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { format } from "date-fns";
import { newDraftId, openDeviceDrafts } from "../lib/device-drafts";
import type { Draft, DraftBody, DraftScope } from "../lib/draft-vault";
import { colors } from "../lib/theme";

function Action({label, onPress, disabled=false, selected}: {label:string; onPress:()=>void; disabled?:boolean; selected?:boolean}) {
  return <Pressable accessibilityRole="button" accessibilityState={{disabled,selected}} disabled={disabled}
    onPress={onPress} style={[s.action,selected && s.selected,disabled && {opacity:0.5}]}>
    <Text style={s.actionText}>{label}</Text></Pressable>;
}
const emptyBody = (): DraftBody => ({type:"expense",amount:"",date:format(new Date(),"yyyy-MM-dd"),note:"",
  accountId:"",categoryId:null,tagIds:[]});

export function DeviceDrafts({scope,accounts,categories=[],tags=[],onClose,offline=false,onPost}:{
  scope:DraftScope; accounts:{id:string;name:string}[]; categories?:{id:string;name:string;kind:string}[];
  tags?:{id:string;name:string}[]; onClose:()=>void; offline?:boolean; onPost?:()=>void;
}) {
  const [drafts,setDrafts] = useState<Draft[]>([]);
  const [editing,setEditing] = useState<Draft|null>(null);
  const [body,setBody] = useState(emptyBody);
  const [showForm,setShowForm] = useState(false);
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const running = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    Promise.resolve().then(()=>openDeviceDrafts(scope).list()).then(rows => {if(active)setDrafts(rows);})
      .catch(() => {if(active)setMessage("Could not read device drafts. Reopen your tracker.");});
    return () => {active = false; mounted.current = false;};
  }, [scope.actor,scope.workspace]);
  async function run(action:(session:ReturnType<typeof openDeviceDrafts>)=>Promise<string>) {
    if (!mounted.current || running.current) return;
    running.current=true; setBusy(true); setMessage("");
    try {
      const session=openDeviceDrafts(scope);
      try { const result=await action(session); if(mounted.current)setMessage(result); }
      finally {const rows=await session.list(); if(mounted.current)setDrafts(rows);}
    } catch(error) {if(mounted.current)setMessage(error instanceof Error ? error.message : "Could not finish this action.");}
    finally {running.current=false;if(mounted.current)setBusy(false);}
  }
  function edit(draft:Draft|null) {
    setEditing(draft);setBody(draft?.body ?? emptyBody());setShowForm(true);setMessage("");
  }
  function save() {
    const amount=body.amount.trim().replace(",",".");
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(amount) || Number(amount)<=0) return setMessage("Enter a positive amount with up to two decimal places.");
    const parsed=new Date(body.date+"T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date) || body.date.startsWith("0000") || !Number.isFinite(+parsed) || parsed.toISOString().slice(0,10)!==body.date)
      return setMessage("Enter a calendar date as YYYY-MM-DD.");
    void run(async session => {
      await session.save(editing?.id ?? newDraftId(),editing?.revision ?? 0,{...body,amount,note:body.note.trim()});
      setShowForm(false);return "Saved on this phone. Review it before posting.";
    });
  }
  function post(draft:Draft) {
    void run(async session=>{
      const receipt=await session.post(draft);
      onPost?.();return receipt.replayed ? "Already posted. The original entry was confirmed." : "Posted to Activity.";
    });
  }
  return <SafeAreaView style={s.safe}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.page}>
    <Action label={offline?"Back to connection options":"Back"} onPress={onClose} disabled={busy}/>
    <Text accessibilityRole="header" style={s.title}>Device drafts</Text>
    <Text style={s.hint}>{offline?"Offline · Capture income or expenses now. Choose an account and post after reconnecting.":"Private to you in this tracker. Drafts affect your balances only after you post them."}</Text>
    {showForm ? <View style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>{editing?"Edit draft":"New draft"}</Text>
      <View style={s.wrap}>{(["expense","income"] as const).map(type=><Action key={type} label={type==="expense"?"Expense":"Income"}
        selected={body.type===type} onPress={()=>setBody({...body,type,categoryId:body.type===type?body.categoryId:null})}/>)}</View>
      <Text>Amount</Text><TextInput accessibilityLabel="Amount" style={s.input} value={body.amount} onChangeText={amount=>setBody({...body,amount})} keyboardType="decimal-pad" maxLength={16}/>
      <Text>Date (YYYY-MM-DD)</Text><TextInput accessibilityLabel="Date in year month day format" style={s.input} value={body.date} onChangeText={date=>setBody({...body,date})} maxLength={10}/>
      <Text>Note</Text><TextInput accessibilityLabel="Note" style={s.input} value={body.note} onChangeText={note=>setBody({...body,note})} maxLength={200}/>
      {!offline && <><Text>Account</Text><View style={s.wrap}>{accounts.map(a=><Action key={a.id} label={a.name} selected={a.id===body.accountId}
        onPress={()=>setBody({...body,accountId:a.id})}/>)}</View>
        <Text>Category</Text><View style={s.wrap}><Action label="Uncategorized" selected={!body.categoryId} onPress={()=>setBody({...body,categoryId:null})}/>
          {categories.filter(c=>c.kind===body.type).map(c=><Action key={c.id} label={c.name} selected={body.categoryId===c.id} onPress={()=>setBody({...body,categoryId:c.id})}/>)}</View>
        {(tags.length>0 || body.tagIds.length>0) && <><Text>Tags</Text><View style={s.wrap}><Action label="Clear tags" onPress={()=>setBody({...body,tagIds:[]})}/>
          {tags.map(t=><Action key={t.id} label={t.name} selected={body.tagIds.includes(t.id)} onPress={()=>setBody({...body,
            tagIds:body.tagIds.includes(t.id)?body.tagIds.filter(id=>id!==t.id):[...body.tagIds,t.id]})}/>)}</View></>}
      </>}
      <View style={s.wrap}><Action label="Save on this phone" onPress={save} disabled={busy}/><Action label="Cancel" onPress={()=>setShowForm(false)} disabled={busy}/></View>
    </View>:<Action label="New device draft" onPress={()=>edit(null)} disabled={busy}/>}
    {message ? <Text accessibilityLiveRegion="polite" accessibilityRole="alert">{message}</Text>:null}
    <Text accessibilityRole="header" style={s.heading}>Waiting for review · {drafts.length}</Text>
    {drafts.map(draft=>{
      const account=accounts.find(a=>a.id===draft.body.accountId);
      return <View key={draft.id} style={s.card}>
        <Text style={s.heading}>{draft.body.type==="income"?"Income":"Expense"} · {draft.body.amount}</Text>
        <Text>{draft.body.date}{account ? " · "+account.name : ""}{draft.body.note ? "\n"+draft.body.note : ""}</Text>
        <Text style={s.hint}>{draft.conflict==="deleted"?"This entry was posted and later deleted. Review before making a separate entry.":
          draft.conflict==="different"?"The original receipt has different details. Check Activity and compare it with this device copy.":
          draft.pending?"Awaiting receipt · Retry to check the original save.":account || offline?"Saved on this phone":"Choose an active account before posting."}</Text>
        <View style={s.wrap}>
          {!draft.pending && !draft.conflict && <Action label="Edit" onPress={()=>edit(draft)} disabled={busy}/>}
          {draft.conflict && <Action label="Prepare separate entry" disabled={busy} onPress={()=>Alert.alert("Prepare a separate entry?",
            "Review Activity first. Posting a new draft later will create another transaction.",[{text:"Cancel",style:"cancel"},
              {text:"Prepare draft",onPress:()=>{edit(null);setBody({...draft.body});}}])}/>}
          {!offline && !draft.conflict && <Action label={draft.pending?"Check receipt":"Post to Activity"} onPress={()=>post(draft)} disabled={busy || (!draft.pending && !account)}/>}
          {!draft.pending && <Action label="Discard" disabled={busy} onPress={()=>Alert.alert("Discard this device draft?", "This removes the saved copy from this phone.",[
            {text:"Keep",style:"cancel"},{text:"Discard",style:"destructive",onPress:()=>void run(async session=>{await session.discard(draft);return "Draft discarded.";})}])}/>}
        </View></View>;
    })}
  </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.bg},page:{padding:18,gap:12,paddingBottom:40},
  title:{fontSize:24,fontWeight:"700",color:colors.ink},heading:{fontSize:17,fontWeight:"600",color:colors.ink},
  hint:{color:colors.inkSoft,fontSize:15},card:{padding:16,gap:10,backgroundColor:colors.card,borderRadius:12,borderWidth:1,borderColor:colors.border},
  wrap:{flexDirection:"row",flexWrap:"wrap",gap:8},action:{minHeight:46,justifyContent:"center",paddingHorizontal:14,paddingVertical:8,backgroundColor:colors.cardAlt,borderRadius:8},
  selected:{backgroundColor:colors.greenSoft,borderColor:colors.green,borderWidth:1},actionText:{fontSize:15,color:colors.green,fontWeight:"600"},
  input:{borderWidth:1,borderColor:colors.borderStrong,borderRadius:8,minHeight:46,padding:10,color:colors.ink,fontSize:16},
});
