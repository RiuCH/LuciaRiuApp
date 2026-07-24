-- v6 migration: chosen-photo picks for journeys.
-- Run once in the Supabase SQL editor (projects created from schema.sql
-- after v6 already have the column).

alter table journeys add column if not exists photo_guids text;
