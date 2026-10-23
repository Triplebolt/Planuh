import { sql } from 'drizzle-orm';
import { bigint, check, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

/**
 * Segment types and values (REQ-SEG-001). Names are unique per workspace
 * (segment_type) or per type (segment_value), compared trimmed and
 * case-insensitively at the application layer (packages/domain naming.ts) —
 * the database index below is a defense-in-depth backstop, not the primary
 * duplicate check, since Postgres citext would need an extension.
 */
export const segmentType = pgTable(
  'segment_type',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('segment_type_workspace_name_key').on(table.workspaceId, table.name)],
);

export const segmentValue = pgTable(
  'segment_value',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    segmentTypeId: uuid('segment_type_id')
      .notNull()
      .references(() => segmentType.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('segment_value_type_name_key').on(table.segmentTypeId, table.name)],
);

/**
 * Minimal stand-in tables — Budget Allocation and Campaign Plan own the real
 * shape of these. They exist here only so the segment tasks (filing under
 * "Not set", the in-use check, splitting) have something concrete to
 * reference; those features extend rather than replace this table.
 */
export const allocation = pgTable('allocation', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull(),
  name: text('name').notNull(),
  amountMinorUnits: bigint('amount_minor_units', { mode: 'bigint' }).notNull(),
  currency: text('currency').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const campaign = pgTable('campaign', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull(),
  allocationId: uuid('allocation_id')
    .notNull()
    .references(() => allocation.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Which segment value (or "Not set", when segmentValueId is null) an
 * allocation or campaign carries for a given segment type. No copied name is
 * stored here, so a rename in segment_value is visible everywhere at once
 * (AC-SEG-002.2).
 */
export const segmentAssignment = pgTable(
  'segment_assignment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    segmentTypeId: uuid('segment_type_id')
      .notNull()
      .references(() => segmentType.id, { onDelete: 'cascade' }),
    segmentValueId: uuid('segment_value_id').references(() => segmentValue.id, {
      onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('segment_assignment_entity_type_key').on(
      table.entityType,
      table.entityId,
      table.segmentTypeId,
    ),
    check(
      'segment_assignment_entity_type_check',
      sql`${table.entityType} in ('allocation', 'campaign')`,
    ),
  ],
);
