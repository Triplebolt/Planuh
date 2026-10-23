CREATE TABLE "allocation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount_minor_units" bigint NOT NULL,
	"currency" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"allocation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segment_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"segment_type_id" uuid NOT NULL,
	"segment_value_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "segment_assignment_entity_type_key" UNIQUE("entity_type","entity_id","segment_type_id"),
	CONSTRAINT "segment_assignment_entity_type_check" CHECK ("segment_assignment"."entity_type" in ('allocation', 'campaign'))
);
--> statement-breakpoint
CREATE TABLE "segment_type" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "segment_type_workspace_name_key" UNIQUE("workspace_id","name")
);
--> statement-breakpoint
CREATE TABLE "segment_value" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"segment_type_id" uuid NOT NULL,
	"name" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "segment_value_type_name_key" UNIQUE("segment_type_id","name")
);
--> statement-breakpoint
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_allocation_id_allocation_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."allocation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_assignment" ADD CONSTRAINT "segment_assignment_segment_type_id_segment_type_id_fk" FOREIGN KEY ("segment_type_id") REFERENCES "public"."segment_type"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_assignment" ADD CONSTRAINT "segment_assignment_segment_value_id_segment_value_id_fk" FOREIGN KEY ("segment_value_id") REFERENCES "public"."segment_value"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_value" ADD CONSTRAINT "segment_value_segment_type_id_segment_type_id_fk" FOREIGN KEY ("segment_type_id") REFERENCES "public"."segment_type"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- ADR-002: tenant isolation by row-level security. Every tenant-owned table
-- gets its policy in this same migration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_role') THEN
    CREATE ROLE app_role NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "allocation" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "allocation_tenant_isolation" ON "allocation"
  USING ("workspace_id" = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "campaign" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "campaign_tenant_isolation" ON "campaign"
  USING ("workspace_id" = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "segment_assignment" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "segment_assignment_tenant_isolation" ON "segment_assignment"
  USING ("workspace_id" = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "segment_type" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "segment_type_tenant_isolation" ON "segment_type"
  USING ("workspace_id" = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "segment_value" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "segment_value_tenant_isolation" ON "segment_value"
  USING ("workspace_id" = current_setting('app.workspace_id', true)::uuid)
  WITH CHECK ("workspace_id" = current_setting('app.workspace_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "allocation", "campaign", "segment_assignment", "segment_type", "segment_value" TO app_role;