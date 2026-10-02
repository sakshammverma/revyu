/**
 * Python `datetime.isoformat()` look-alike for timestamptz values (UTC,
 * "+00:00" suffix). A JS Date carries milliseconds, so the microseconds
 * Python would print are dropped.
 */
export const pyIso = (d: Date): string => d.toISOString().replace("Z", "+00:00");
