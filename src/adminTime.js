// Database timestamps are UTC. Older timestamp-without-time-zone columns may
// omit the suffix; browser-local parsing would shift them by the owner's offset.
export const parseAdminDate = (value) => {
  if (!value) return null;
  let input = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(input)) {
    input = `${input.replace(" ", "T")}Z`;
  }
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatAdminDate = (value) => {
  const date = parseAdminDate(value);
  return date ? new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  }).format(date) : "—";
};

export const adminTimeAgo = (value) => {
  const date = parseAdminDate(value);
  if (!date) return "Never";
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < -2) return "Future timestamp";
  if (minutes < 60) return minutes < 2 ? "Just now" : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
};
