-- Automation Passport provenance and organisation-scoped sharing.
-- Provenance columns are write-once at the application layer.

ALTER TABLE facilities
    ADD COLUMN IF NOT EXISTS organisation_id UUID;

ALTER TABLE skills
    ADD COLUMN IF NOT EXISTS origin_passport_id UUID,
    ADD COLUMN IF NOT EXISTS parent_skill_id UUID REFERENCES skills(id);

CREATE TABLE IF NOT EXISTS organisations (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organisation_links (
    id UUID PRIMARY KEY,
    organisation_a_id UUID NOT NULL REFERENCES organisations(id),
    organisation_b_id UUID NOT NULL REFERENCES organisations(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT organisation_links_distinct CHECK (organisation_a_id <> organisation_b_id),
    CONSTRAINT organisation_links_unique UNIQUE (organisation_a_id, organisation_b_id)
);

CREATE TABLE IF NOT EXISTS automation_passports (
    id UUID PRIMARY KEY,
    source_task_id UUID NOT NULL,
    source_robot_model TEXT NOT NULL,
    source_org_id UUID NOT NULL REFERENCES organisations(id),
    task_intent JSONB NOT NULL,
    fixture_spec JSONB,
    gripper_recommendations JSONB,
    quality_parameters JSONB NOT NULL,
    sharing_scope TEXT NOT NULL CHECK (sharing_scope IN ('PRIVATE', 'ORGANISATION', 'SHARED_LINK')),
    recipient_org_id UUID REFERENCES organisations(id),
    share_token_hash TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_passports_recipient
    ON automation_passports(recipient_org_id, created_at DESC);
