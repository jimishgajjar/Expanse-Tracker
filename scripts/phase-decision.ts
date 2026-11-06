import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { phaseDecision } from "../src/lib/phase-decision";
try {
  if(process.argv.length!==3)throw Error("Pass one anonymous evidence JSON file.");
  const bytes=readFileSync(process.argv[2]);
  if(bytes.length>1024*1024)throw Error("Evidence file exceeds 1 MiB.");
  const report=phaseDecision(JSON.parse(bytes.toString("utf8")));
  console.log(JSON.stringify({...report,evidenceSha256:createHash("sha256").update(bytes).digest("hex")},null,2));
}catch{
  // Validation messages contain no entered values or private free text.
  console.error("Cannot read or validate evidence. Pass one anonymous JSON file under 1 MiB; check the template, dates, counts and required fields.");
  process.exitCode=1;
}
