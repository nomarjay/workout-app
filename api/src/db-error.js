export function formatDatabaseError(error) {
  const serverErrors = [...(error?.reason?.servers?.values?.() || [])]
    .map((server) => server.error?.cause?.message || server.error?.message)
    .filter(Boolean);
  const details = [...new Set(serverErrors)].slice(0, 3);
  const message = [String(error?.message || error), ...details]
    .join(' | ')
    .replace(/mongodb(?:\+srv)?:\/\/[^\s'"<>]+/gi, '<redacted MongoDB URI>');
  return `${error?.name || 'DatabaseError'}: ${message}`;
}
