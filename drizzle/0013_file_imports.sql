CREATE TABLE "file_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"file_hash" text NOT NULL,
	"filename" text NOT NULL,
	"headers" jsonb NOT NULL,
	"mapping" jsonb NOT NULL,
	"currency" text NOT NULL,
	"rows" jsonb NOT NULL,
	"receipt" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"staged_by" text NOT NULL,
	"approved_by" text,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "import_ws_file_key" UNIQUE("workspace_id","file_hash")
);
--> statement-breakpoint
ALTER TABLE "file_imports" ADD CONSTRAINT "file_imports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE FUNCTION file_import_candidates(w text,a text,d date,k tx_kind,v numeric) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]'::jsonb) FROM (
    SELECT id,note FROM transactions WHERE workspace_id=w AND account_id=a AND date=d AND type=k AND amount=v ORDER BY id LIMIT 21
  ) c
$$;
--> statement-breakpoint
CREATE FUNCTION approve_file_import(w text,actor text,actor_name_in text,batch_id text,expected integer,choices jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE b file_imports%ROWTYPE; r jsonb; decision text; target text; result jsonb := '[]'; used text[] := '{}'; candidates jsonb; item jsonb;
BEGIN
  PERFORM 1 FROM workspace_members WHERE workspace_id=w AND user_id=actor AND role IN ('owner','member') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Import access denied'; END IF;
  -- Serialize file approvals in a workspace, including overlapping but differently encoded files.
  PERFORM pg_advisory_xact_lock(hashtextextended('file-import:'||w,0));
  SELECT * INTO b FROM file_imports WHERE workspace_id=w AND id=batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Import not found'; END IF;
  IF b.receipt IS NOT NULL THEN RETURN b.receipt; END IF;
  IF b.version<>expected OR b.currency<>coalesce((SELECT currency_code FROM app_settings WHERE workspace_id=w),'INR') THEN RAISE EXCEPTION 'Import preview changed'; END IF;
  IF jsonb_typeof(choices) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(choices))<>jsonb_array_length(b.rows) THEN RAISE EXCEPTION 'Review every row'; END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(b.rows) LOOP
    decision:=choices->>(r->>'line'); target:=NULL;
    IF decision IS NULL THEN RAISE EXCEPTION 'Review every row'; END IF;
    IF decision<>'ignore' THEN
      IF jsonb_array_length(r->'errors')>0 THEN RAISE EXCEPTION 'Invalid row'; END IF;
      PERFORM 1 FROM accounts WHERE workspace_id=w AND id=r->>'accountId' AND NOT archived AND name=r->>'account' FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Account changed'; END IF;
      IF r->>'categoryId' IS NOT NULL THEN
        PERFORM 1 FROM categories WHERE workspace_id=w AND id=r->>'categoryId' AND kind=(r->>'type')::tx_kind AND lower(name)=lower(r->>'category') FOR SHARE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Category changed'; END IF;
      END IF;
      candidates:=file_import_candidates(w,r->>'accountId',(r->>'date')::date,(r->>'type')::tx_kind,(r->>'amount')::numeric);
      IF candidates<>r->'candidates' THEN RAISE EXCEPTION 'Candidates changed'; END IF;
      IF decision LIKE 'match:%' THEN
        target:=substr(decision,7);
        IF target=ANY(used) OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(candidates) c WHERE c->>'id'=target) THEN RAISE EXCEPTION 'Invalid or repeated match'; END IF;
        PERFORM 1 FROM transactions WHERE workspace_id=w AND id=target AND account_id=r->>'accountId' AND date=(r->>'date')::date AND type=(r->>'type')::tx_kind AND amount=(r->>'amount')::numeric FOR SHARE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Match changed'; END IF;
        used:=array_append(used,target); decision:='match';
      ELSIF decision='separate' OR (decision='import' AND candidates='[]'::jsonb AND NOT (r->>'repeated')::boolean) THEN
        target:=gen_random_uuid()::text; decision:='import';
      ELSE RAISE EXCEPTION 'Choose a valid decision for this row'; END IF;
    END IF;
    result:=result||jsonb_build_array(jsonb_build_object('line',(r->>'line')::integer,'action',decision,'transactionId',target));
  END LOOP;
  FOR item,r IN SELECT o.value,s.value FROM jsonb_array_elements(result) WITH ORDINALITY o JOIN jsonb_array_elements(b.rows) WITH ORDINALITY s USING(ordinality) LOOP
    IF item->>'action'='import' THEN
      INSERT INTO transactions(id,workspace_id,type,amount,date,note,account_id,category_id,created_by)
      VALUES(item->>'transactionId',w,(r->>'type')::tx_kind,(r->>'amount')::numeric,(r->>'date')::date,r->>'note',r->>'accountId',r->>'categoryId',actor);
      INSERT INTO transaction_history(id,workspace_id,transaction_id,actor_id,actor_name,"before","after")
      SELECT 'import:'||t.id,w,t.id,actor,actor_name_in,'{}'::jsonb,to_jsonb(t)||jsonb_build_object('tag_ids','[]'::jsonb,'_creation',jsonb_build_object('source','file','batchId',b.id,'fileHash',b.file_hash,'line',r->'line'))
      FROM transactions t WHERE t.id=item->>'transactionId';
    END IF;
  END LOOP;
  UPDATE file_imports SET receipt=result,approved_by=actor,approved_at=now(),version=version+1 WHERE id=b.id;
  RETURN result;
END $$;
