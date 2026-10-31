import { PGlite } from "@electric-sql/pglite";
import { resolve } from "node:path";
import {
  applyCommand,
  DemoError,
  initialState,
  type Command,
  type DemoState,
} from "./model";
import { bankDemoEnabled } from "./config";

/** Separate database, no application ledger imports or production driver. */
export class DemoStore {
  private ready: Promise<unknown>;
  constructor(private db: PGlite) {
    this.ready = db.exec(
      "CREATE TABLE IF NOT EXISTS demo_sessions (workspace_id text PRIMARY KEY, version integer NOT NULL, state jsonb NOT NULL)",
    );
  }
  async read(workspace: string): Promise<DemoState> {
    await this.ready;
    await this.db.query(
      "INSERT INTO demo_sessions VALUES ($1, 0, $2::jsonb) ON CONFLICT DO NOTHING",
      [workspace, JSON.stringify(initialState())],
    );
    const result = await this.db.query<{ state: DemoState }>(
      "SELECT state FROM demo_sessions WHERE workspace_id = $1",
      [workspace],
    );
    return result.rows[0].state;
  }
  async change(
    workspace: string,
    version: number,
    command: Command,
  ): Promise<DemoState> {
    const state = await this.read(workspace);
    if (state.version !== version)
      throw new DemoError(
        "The demo changed in another tab. Refresh and review again.",
      );
    const next = applyCommand(state, command, new Date().toISOString());
    const result = await this.db.query(
      "UPDATE demo_sessions SET version = $1, state = $2::jsonb WHERE workspace_id = $3 AND version = $4 RETURNING version",
      [next.version, JSON.stringify(next), workspace, version],
    );
    if (!result.rows.length)
      throw new DemoError(
        "The demo changed in another tab. Refresh and review again.",
      );
    return next;
  }
}

const globalDemo = globalThis as unknown as { __bankDemoStore?: DemoStore };
export function getDemoStore(): DemoStore {
  if (!bankDemoEnabled())
    throw new DemoError("Bank demo is disabled in this environment.");
  // Fixed dedicated path: cannot point the simulator at either application DB.
  return (globalDemo.__bankDemoStore ??= new DemoStore(
    new PGlite(resolve(process.cwd(), ".pglite-bank-demo")),
  ));
}
