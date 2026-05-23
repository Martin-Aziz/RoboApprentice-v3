-- FORGE MIND — Initial Database Schema
-- Migration: 001_initial_schema
-- Date: 2026-04-20

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ─── Users ─────────────────────────────────────
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ─── Facilities ────────────────────────────────
CREATE TABLE facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_facilities_owner ON facilities(owner_id);

-- ─── Robots ────────────────────────────────────
CREATE TABLE robots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    urdf_hash TEXT,
    status TEXT NOT NULL DEFAULT 'offline',
    ip_address INET,
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_robots_facility ON robots(facility_id, status);

-- ─── Skills ────────────────────────────────────
CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    task_language TEXT NOT NULL,
    confidence DOUBLE PRECISION DEFAULT 0.0,
    status TEXT NOT NULL DEFAULT 'draft',
    policy_data JSONB,
    embedding VECTOR(384),
    run_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_skills_facility ON skills(facility_id);
CREATE INDEX idx_skills_status ON skills(facility_id, status);
CREATE INDEX idx_skills_embedding ON skills USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ─── Demonstrations ────────────────────────────
CREATE TABLE demonstrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    video_path TEXT,
    voice_transcript TEXT,
    source_robot_id UUID REFERENCES robots(id) ON DELETE SET NULL,
    quality_score DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_demonstrations_skill ON demonstrations(skill_id);

-- ─── Skill Executions ──────────────────────────
CREATE TABLE skill_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    robot_id UUID NOT NULL REFERENCES robots(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'started',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    parts_processed INTEGER NOT NULL DEFAULT 0,
    error_message TEXT
);

CREATE INDEX idx_executions_skill ON skill_executions(skill_id, started_at DESC);
CREATE INDEX idx_executions_robot ON skill_executions(robot_id, started_at DESC);

-- ─── Refresh Tokens ────────────────────────────
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
