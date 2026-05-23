#!/bin/bash
# FORGE MIND — Seed script for development
# Usage: ./scripts/seed.sh
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://forge:forge_dev_password@localhost:5432/forge_mind}"

echo "Seeding FORGE MIND database..."

psql "$DB_URL" <<'SQL'
-- Demo user (password: "password123" hashed with argon2)
-- This hash is pre-computed for dev convenience
INSERT INTO users (id, email, password_hash, name, role)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'alex@forgeshop.com',
    '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$7GWuEq6VNVqaRj5NVMY87BW7VRB0rlBd0c8l5gAWAQo',
    'Alex Chen',
    'admin'
) ON CONFLICT (email) DO NOTHING;

-- Demo facility
INSERT INTO facilities (id, name, owner_id)
VALUES (
    '00000000-0000-0000-0000-000000000010',
    'Chen Manufacturing',
    '00000000-0000-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

-- Demo robots
INSERT INTO robots (id, facility_id, name, brand, model, status) VALUES
    ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000010', 'Cobot Alpha', 'simulator', 'Virtual UR5e', 'idle'),
    ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000010', 'Cobot Beta', 'simulator', 'Virtual Jaka Zu 7', 'offline')
ON CONFLICT DO NOTHING;

-- Demo skills
INSERT INTO skills (id, facility_id, name, description, task_language, confidence, status, run_count, success_count, created_by) VALUES
    ('00000000-0000-0000-0000-000000001000', '00000000-0000-0000-0000-000000000010', 'Pick & Place Brackets', 'Pick aluminum brackets from bin A and place in fixture', 'Pick up the bracket from the left bin, rotate 90 degrees, and press into the fixture slot until it clicks.', 0.87, 'ready', 45, 42, '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000010', 'Screw Insertion M4', 'Insert M4x12mm screws into bracket assembly', 'Pick the M4 screw from the feeder, align with the hole on the bracket, and drive in until flush.', 0.72, 'ready', 18, 15, '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000001002', '00000000-0000-0000-0000-000000000010', 'Quality Inspection', 'Visual inspection of finished brackets', 'Hold the bracket under the camera, rotate slowly for all-sides inspection, then place in pass or fail bin.', 0.45, 'training', 3, 2, '00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Demo executions
INSERT INTO skill_executions (id, skill_id, robot_id, status, started_at, completed_at, parts_processed) VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-000000001000', '00000000-0000-0000-0000-000000000100', 'completed', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 45 minutes', 12),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000001000', '00000000-0000-0000-0000-000000000100', 'completed', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hour 30 minutes', 8),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-000000000100', 'completed', NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours', 18)
ON CONFLICT DO NOTHING;

SQL

echo "Seed complete!"
