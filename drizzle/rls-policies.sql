-- =============================================================================
-- RLS Policies for ChurnGuard (Supabase PostgreSQL)
-- Apply via Supabase SQL Editor or drizzle-kit push
-- =============================================================================
--
-- IMPORTANT: These policies apply when accessing the DB via Supabase clients
-- (anon key). The application uses Drizzle ORM with a direct postgres connection
-- (DATABASE_URL), which bypasses RLS. The service_role key also bypasses RLS.
-- This is defense-in-depth against direct Supabase API access.
-- =============================================================================

-- Helper function: returns the organization_id for the current authenticated user
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- =============================================================================
-- Enable RLS on all tables
-- =============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dunning_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Policies: organizations
-- =============================================================================

CREATE POLICY "org_isolation" ON organizations
  FOR ALL
  USING (id = get_user_organization_id());

-- =============================================================================
-- Policies: organization_members
-- =============================================================================

CREATE POLICY "org_isolation" ON organization_members
  FOR ALL
  USING (organization_id = get_user_organization_id());

-- =============================================================================
-- Policies: failed_payments
-- =============================================================================

CREATE POLICY "org_isolation" ON failed_payments
  FOR ALL
  USING (organization_id = get_user_organization_id());

-- =============================================================================
-- Policies: dunning_jobs
-- =============================================================================

CREATE POLICY "org_isolation" ON dunning_jobs
  FOR ALL
  USING (organization_id = get_user_organization_id());

-- =============================================================================
-- Policies: recovery_metrics
-- =============================================================================

CREATE POLICY "org_isolation" ON recovery_metrics
  FOR ALL
  USING (organization_id = get_user_organization_id());

-- =============================================================================
-- Policies: webhook_events
-- =============================================================================

CREATE POLICY "org_isolation" ON webhook_events
  FOR ALL
  USING (organization_id = get_user_organization_id());

-- =============================================================================
-- Policies: payment_tokens
-- No direct user access — service role only (webhook/cron writes, public page reads via Server Action)
-- =============================================================================

CREATE POLICY "no_direct_access" ON payment_tokens
  FOR ALL
  USING (false);

-- =============================================================================
-- Policies: notifications
-- =============================================================================

CREATE POLICY "org_isolation" ON notifications
  FOR ALL
  USING (organization_id = get_user_organization_id());

-- =============================================================================
-- Policies: invitations
-- =============================================================================

CREATE POLICY "org_isolation" ON invitations
  FOR ALL
  USING (organization_id = get_user_organization_id());
