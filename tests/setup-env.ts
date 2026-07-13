// Runs before test files load. Removing the Supabase/Clerk configuration makes
// the backend fall back to the in-memory store and skip token verification, so
// unit tests are deterministic and never touch the network.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_PUBLISHABLE_KEY;
delete process.env.CLERK_SECRET_KEY;
