-- Query plan checks for the hot paths.
-- Run:  mysql -h <host> -u imigrasi_user -p imigrasi_db < scripts/explain_queries.sql
--
-- Look for: type = ref/range/eq_ref/const and a non-NULL `key`.
-- Avoid:    type = ALL (full table scan) unless the table is tiny.

-- 1. Passenger listing filtered by agent, newest first (agent dashboard / list)
EXPLAIN
SELECT id, full_name, passport_number, status, created_at
FROM passengers
WHERE agent_id = 1 AND created_at >= '2026-01-01'
ORDER BY created_at DESC
LIMIT 25;

-- 2. Pending passenger list filtered by status
EXPLAIN
SELECT id, full_name, status, created_at
FROM passengers
WHERE status = 'PENDING'
ORDER BY created_at DESC
LIMIT 25;

-- 3. Direction + recent (arrivals/departures counters)
EXPLAIN
SELECT COUNT(*)
FROM passengers
WHERE direction = 'ARRIVAL' AND created_at >= '2026-01-01 00:00:00';

-- 4. Blacklist lookup by normalized passport (critical path)
EXPLAIN
SELECT id, reason
FROM blacklists
WHERE is_active = 1 AND passport_normalized = 'AB123456'
LIMIT 1;

-- 5. Blacklist lookup by normalized name
EXPLAIN
SELECT id, reason
FROM blacklists
WHERE is_active = 1 AND name_normalized = 'JOHN DOE'
LIMIT 1;

-- 6. Pending escalations ordered by age
EXPLAIN
SELECT id, passenger_id, created_at
FROM escalations
WHERE decision = 'PENDING'
ORDER BY created_at ASC;

-- 7. Pending VOA list
EXPLAIN
SELECT id, passenger_id, applied_at
FROM voa_applications
WHERE status = 'PENDING'
ORDER BY applied_at DESC
LIMIT 25;

-- 8. Audit log by user + time window
EXPLAIN
SELECT id, action, created_at
FROM audit_logs
WHERE user_id = 1 AND created_at >= '2026-01-01'
ORDER BY created_at DESC
LIMIT 50;

-- 9. Login rate-limit lookup
EXPLAIN
SELECT COUNT(*)
FROM login_attempts
WHERE ip_address = '10.0.0.1' AND created_at >= '2026-01-01 00:00:00';

-- 10. Unread notifications for a user
EXPLAIN
SELECT id, title, created_at
FROM notifications
WHERE user_id = 1 AND is_read = 0
ORDER BY created_at DESC
LIMIT 50;
