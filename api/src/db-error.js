export function formatDatabaseError(error) {
  const message = String(error?.message || error)
    .replace(/mongodb(?:\+srv)?:\/\/[^\s'"<>]+/gi, '<redacted MongoDB URI>');
  return `${error?.name || 'DatabaseError'}: ${message}`;
}
