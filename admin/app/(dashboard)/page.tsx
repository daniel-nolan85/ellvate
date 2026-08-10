export default function OverviewPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-content">Overview</h1>
      <p className="max-w-xl text-sm text-muted">
        This is the first slice of the admin dashboard — sign-in, the admin
        allowlist, and the featured-event toggle. Content moderation (posts,
        comments, missions, services) and the unified report queue land next.
      </p>
    </div>
  );
}
