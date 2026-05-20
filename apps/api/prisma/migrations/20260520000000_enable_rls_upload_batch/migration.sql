-- Enable Row Level Security on UploadBatch (and its child DocumentSection).
--
-- UploadBatch was introduced in migration 20260515125103 after the bulk RLS
-- migration (20260513000000) had already run, so it was not covered.
-- Supabase's linter flagged it as EXTERNAL-facing without RLS.
--
-- Same rationale as 20260513000000: all data access goes through the Node.js
-- API server which uses the service_role connection (BYPASSRLS). No PostgREST
-- policies are required.

ALTER TABLE "public"."UploadBatch" ENABLE ROW LEVEL SECURITY;
