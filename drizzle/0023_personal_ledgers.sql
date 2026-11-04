CREATE TABLE "personal_ledgers" (
	"ledger_id" text PRIMARY KEY NOT NULL,
	"household_id" text NOT NULL,
	"person_id" text NOT NULL,
	CONSTRAINT "personal_ledger_per_member" UNIQUE("household_id","person_id"),
	CONSTRAINT "personal_ledger_distinct" CHECK ("personal_ledgers"."ledger_id" <> "personal_ledgers"."household_id")
);
--> statement-breakpoint
ALTER TABLE "personal_ledgers" ADD CONSTRAINT "personal_ledgers_ledger_id_workspaces_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_ledgers" ADD CONSTRAINT "personal_ledgers_household_id_workspaces_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_ledgers" ADD CONSTRAINT "personal_ledgers_person_id_users_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
-- All existing trackers and their entries remain untouched. A personal scope
-- is a fresh ledger, never an ownership guess about an existing bank account.
CREATE FUNCTION personal_ledger_validate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM workspaces WHERE id = OLD.ledger_id) THEN
      RAISE EXCEPTION 'Cannot detach a personal ledger';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' OR NOT starts_with(NEW.ledger_id, 'personal:') OR starts_with(NEW.household_id, 'personal:')
    OR NOT EXISTS (SELECT 1 FROM workspaces WHERE id = NEW.ledger_id AND owner_id = NEW.person_id)
    OR EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = NEW.ledger_id AND user_id <> NEW.person_id)
    OR EXISTS (SELECT 1 FROM invitations WHERE workspace_id = NEW.ledger_id) THEN
    RAISE EXCEPTION 'Invalid personal ledger ownership or audience';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER personal_ledger_validate BEFORE INSERT OR UPDATE OR DELETE ON personal_ledgers
  FOR EACH ROW EXECUTE FUNCTION personal_ledger_validate();
--> statement-breakpoint
-- Mirror exactly one membership; never grant tracker-administration/invite
-- powers in a private ledger. Removing a person does not delete their money.
CREATE FUNCTION refresh_personal_membership(home text, person text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE target text; access_role text;
BEGIN
  SELECT ledger_id INTO target FROM personal_ledgers WHERE household_id=home AND person_id=person;
  IF target IS NULL THEN RETURN; END IF;
  SELECT CASE WHEN role IN ('owner','member') THEN 'member' WHEN role='viewer' THEN 'viewer' END
    INTO access_role FROM workspace_members WHERE workspace_id=home AND user_id=person;
  IF access_role IS NULL THEN
    DELETE FROM workspace_members WHERE workspace_id=target AND user_id=person;
  ELSE
    INSERT INTO workspace_members(workspace_id,user_id,role) VALUES(target,person,access_role)
      ON CONFLICT (workspace_id,user_id) DO UPDATE SET role=EXCLUDED.role
      WHERE workspace_members.role IS DISTINCT FROM EXCLUDED.role;
  END IF;
END $$;
--> statement-breakpoint
CREATE FUNCTION personal_membership_changed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='personal_ledgers' THEN
    PERFORM refresh_personal_membership(NEW.household_id,NEW.person_id);
  ELSE
    IF TG_OP <> 'INSERT' THEN PERFORM refresh_personal_membership(OLD.workspace_id,OLD.user_id); END IF;
    IF TG_OP <> 'DELETE' THEN PERFORM refresh_personal_membership(NEW.workspace_id,NEW.user_id); END IF;
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER personal_ledger_linked AFTER INSERT ON personal_ledgers
  FOR EACH ROW EXECUTE FUNCTION personal_membership_changed();
--> statement-breakpoint
CREATE TRIGGER personal_household_role_changed AFTER INSERT OR UPDATE OR DELETE ON workspace_members
  FOR EACH ROW EXECUTE FUNCTION personal_membership_changed();
--> statement-breakpoint
CREATE FUNCTION guard_personal_member() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM personal_ledgers WHERE ledger_id=NEW.workspace_id)
     AND NOT EXISTS (SELECT 1 FROM personal_ledgers p JOIN workspace_members m
       ON m.workspace_id=p.household_id AND m.user_id=p.person_id
       WHERE p.ledger_id=NEW.workspace_id AND p.person_id=NEW.user_id AND m.role IN ('owner','member','viewer')
         AND NEW.role=CASE WHEN m.role='viewer' THEN 'viewer' ELSE 'member' END) THEN
    RAISE EXCEPTION 'Personal access must match current household membership';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER personal_member_guard BEFORE INSERT OR UPDATE ON workspace_members
  FOR EACH ROW EXECUTE FUNCTION guard_personal_member();
--> statement-breakpoint
CREATE FUNCTION guard_personal_admin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='invitations' THEN
    IF starts_with(NEW.workspace_id,'personal:') THEN RAISE EXCEPTION 'Personal ledgers cannot be shared by invitation'; END IF;
  ELSIF starts_with(OLD.id,'personal:') AND (NEW.owner_id<>OLD.owner_id OR NEW.id<>OLD.id) THEN
    RAISE EXCEPTION 'Personal ledger ownership is fixed';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER personal_no_invites BEFORE INSERT OR UPDATE ON invitations
  FOR EACH ROW EXECUTE FUNCTION guard_personal_admin();
--> statement-breakpoint
CREATE TRIGGER personal_no_transfer BEFORE UPDATE OF owner_id,id ON workspaces
  FOR EACH ROW EXECUTE FUNCTION guard_personal_admin();
