/**
 * Formats an ISO date string into a human-readable relative time.
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

  if (diffInDays < 1) {
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    if (diffInHours < 1) {
      const diffInMins = Math.floor(diffInMs / (1000 * 60));
      return diffInMins <= 1 ? "Just now" : `${diffInMins}m ago`;
    }
    return `${diffInHours}h ago`;
  }
  if (diffInDays < 2) return "Yesterday";
  return date.toISOString().split("T")[0];
}
