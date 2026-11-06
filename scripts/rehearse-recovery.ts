/** Synthetic, disk-backed recovery acceptance. Never opens the configured live database. */
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
main().catch(error => { console.error(error instanceof Error ? error.message : "Recovery test failed"); process.exitCode = 1; });
