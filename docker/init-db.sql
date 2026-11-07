-- ==============================================================================
-- TCT AnsiblePulse PostgreSQL Database Initialization
-- Configures required extensions and schemas for high-speed IaC observability
-- ==============================================================================

-- Enable UUID generator
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for fuzzy similarity & fast string search on playbook names
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enable btree_gin for multi-column composite GIN indexes on JSONB and relational fields
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Confirm extension readiness
DO $$
BEGIN
   RAISE NOTICE 'TCT AnsiblePulse PostgreSQL extensions initialized: uuid-ossp, pg_trgm, btree_gin';
END
$$;
