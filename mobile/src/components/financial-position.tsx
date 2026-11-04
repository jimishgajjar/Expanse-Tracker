import { Button, Text, View } from "react-native";
import type { MobilePosition } from "../../../src/lib/mobile-contract";
import { Card } from "./ui";
import { colors } from "../lib/theme";

export function FinancialPosition({finance,original,toggle}:{finance:MobilePosition;original:boolean;toggle:()=>void}) {
  const {position,report,flows}=finance;
  return <Card style={{gap:10,marginBottom:12}}>
    <Text accessibilityRole="header" style={{fontWeight:"700",fontSize:18}}>Financial position</Text>
    {position && report ? <>
      {([["Liquid cash",position.cash],["Debt owed",position.debt],["Net worth",position.worth],
        ["All-time booked income",flows.missing?null:flows.income],["Net spending",flows.missing?null:flows.spending]] as const).map(([label,value])=>
        <View key={label} style={{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",gap:8}}>
          <Text>{label}</Text><Text style={{fontWeight:"600"}}>{value===null?"Incomplete":report+" "+value}</Text>
        </View>)}
      {!!position.missing.length && <Text>Review valuation for {position.missing.join(", ")}.</Text>}
      {flows.missing>0 && <Text>{flows.missing} entries need a denomination or a booked rate.</Text>}
      <Text style={{color:colors.inkSoft}}>Original reports use one display currency and can combine different currencies.</Text>
      <Button title={original?"Hide original tracker tools":"Show original tracker tools"} onPress={toggle}/>
    </>:<Text>Review your accounts in Debt &amp; currencies on the website to see your financial position.</Text>}
  </Card>;
}
