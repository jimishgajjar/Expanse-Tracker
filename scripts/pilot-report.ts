import { readFileSync } from "node:fs";
import { pilotReport } from "../src/lib/pilot-scorecard";
try {
  if (!process.argv[2]) throw Error();
  console.log(JSON.stringify(pilotReport(JSON.parse(readFileSync(process.argv[2],"utf8"))),null,2));
} catch {console.error("Pass a valid anonymous monthly evidence file. See docs/pilot-operations.md for the required fields.");process.exitCode=1;}
