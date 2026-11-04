import { Pressable, Text, View } from "react-native";
import { filters,type EntryFilter,type activityGroups } from "../lib/activity-list";
import { colors } from "../lib/theme";
import { formatDay } from "../lib/format";
import { Card } from "./ui";
import { TxRow } from "./tx-row";

export function EntryFilters({value,onChange}:{value:EntryFilter;onChange:(f:EntryFilter)=>void}) {
  const names={all:"All",income:"Income",expense:"Expenses",transfer:"Transfers"};
  return <View style={{flexDirection:"row",flexWrap:"wrap",gap:4,marginVertical:8}}>{filters.map(f=>
    <Pressable key={f} accessibilityRole="button" accessibilityState={{selected:f===value}} onPress={()=>onChange(f)}
      style={{minHeight:44,paddingHorizontal:12,justifyContent:"center",borderRadius:8,backgroundColor:f===value?colors.greenSoft:colors.cardAlt}}>
      <Text style={{color:f===value?colors.green:colors.ink}}>{names[f]}</Text></Pressable>)}</View>;
}
export function LedgerList({groups,money,account}:{groups:ReturnType<typeof activityGroups>;
  money:{money:(n:number)=>string;signed:(n:number)=>string};account?:string}) {
  if(!groups.length) return <Text style={{padding:16,color:colors.inkSoft}}>No matching activity in this period.</Text>;
  return <>{groups.map(([date,rows])=>{
    const net=rows.reduce((sum,r)=>r.kind==="entry"?sum+(r.value.type==="income"?r.value.amount:-r.value.amount):
      sum+(account===r.value.fromAccountId?-r.value.amount:account===r.value.toAccountId?r.value.amount:0),0);
    return <View key={date} style={{marginBottom:14}}>
      <View style={{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",padding:4}}><Text>{formatDay(date)}</Text><Text>{money.signed(net)}</Text></View>
      <Card style={{padding:0}}>{rows.map(r=><View key={r.kind+r.value.id} style={{borderBottomWidth:1,borderBottomColor:colors.border}}>
        {r.kind==="entry"?<TxRow tx={r.value} fmt={money}/>:<View style={{padding:12,gap:3}}>
          <Text style={{fontWeight:"600"}}>Transfer · {money.money(r.value.amount)}</Text><Text>{r.from} → {r.to}</Text>
          {!!r.value.note && <Text>{r.value.note}</Text>}
        </View>}
      </View>)}</Card></View>;
  })}</>;
}
