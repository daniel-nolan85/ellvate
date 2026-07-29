-- mission_progress.updated_at is set only at insert time (no trigger keeps it
-- current on update), so there's no reliable signal for *when* a mission was
-- completed. The weekly digest needs to scope "missions completed this
-- week", so add a dedicated column, set explicitly by the app only at the
-- moment a mission transitions to 'done' (see checkInSupabase).

alter table mission_progress add column if not exists completed_at timestamptz;
