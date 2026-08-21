interface StoredMedia {
  readonly url: string;
  readonly filename: string;
}

interface MediaThumbnailsProps {
  readonly media: readonly StoredMedia[] | null | undefined;
}

// Matches src/backend/store/types.ts's StoredMedia shape, stored as-is in
// the media jsonb columns (posts/events/missions/service_listings).
export function MediaThumbnails({ media }: MediaThumbnailsProps) {
  if (!media || media.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-1.5">
      {media.map((item) => (
        <a href={item.url} key={item.url} rel="noreferrer" target="_blank">
          {/* eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URLs, not a local asset next/image can optimize */}
          <img
            alt={item.filename}
            className="h-10 w-10 rounded object-cover"
            src={item.url}
          />
        </a>
      ))}
    </div>
  );
}
