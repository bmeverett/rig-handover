import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type JobStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: JobStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

/** Rows are sorted by job. `badLines` counts lines that did not parse. */
export type NightDigest = {
  rows: DigestRow[];
  badLines: number;
};

type OpenRow = DigestRow & { lastErrorAt: string | null };

function isJobStatus(value: unknown): value is JobStatus {
  return value === 'ok' || value === 'retry' || value === 'fail';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Chronological order. Equal instants compare equal so file order can break the tie. */
function compareAt(a: string, b: string): number {
  const am = Date.parse(a);
  const bm = Date.parse(b);
  if (!Number.isNaN(am) && !Number.isNaN(bm)) {
    if (am < bm) return -1;
    if (am > bm) return 1;
    return 0;
  }
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function rowFromLine(value: Record<string, unknown>): OpenRow | null {
  const { at, job, status, owner, error } = value;
  if (typeof at !== 'string' || at === '' || typeof job !== 'string' || job === '' || !isJobStatus(status)) {
    return null;
  }

  const ownerValue = owner === undefined ? null : owner;
  if (ownerValue !== null && typeof ownerValue !== 'string') return null;
  if (error !== undefined && error !== null && typeof error !== 'string') return null;

  const errorText = typeof error === 'string' ? error : null;
  return {
    job,
    owner: ownerValue,
    runs: 1,
    retries: status === 'retry' ? 1 : 0,
    lastStatus: status,
    lastError: errorText,
    lastErrorAt: errorText === null ? null : at,
    firstAt: at,
    lastAt: at,
  };
}

function addLine(byJob: Map<string, OpenRow>, line: OpenRow): void {
  const existing = byJob.get(line.job);
  if (!existing) {
    byJob.set(line.job, line);
    return;
  }

  existing.runs += 1;
  existing.retries += line.retries;

  if (compareAt(line.lastAt, existing.lastAt) >= 0) {
    existing.lastAt = line.lastAt;
    existing.lastStatus = line.lastStatus;
    existing.owner = line.owner;
  }
  if (compareAt(line.firstAt, existing.firstAt) < 0) {
    existing.firstAt = line.firstAt;
  }
  if (line.lastError !== null && line.lastErrorAt !== null) {
    if (existing.lastErrorAt === null || compareAt(line.lastErrorAt, existing.lastErrorAt) >= 0) {
      existing.lastError = line.lastError;
      existing.lastErrorAt = line.lastErrorAt;
    }
  }
}

/** Read `runsDir/<night>.jsonl`. A missing file throws. */
export function readNight(runsDir: string, night: string): NightDigest {
  const text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  const byJob = new Map<string, OpenRow>();
  let badLines = 0;

  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;

    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      badLines += 1;
      continue;
    }

    if (!isRecord(value)) {
      badLines += 1;
      continue;
    }

    const row = rowFromLine(value);
    if (!row) {
      badLines += 1;
      continue;
    }
    addLine(byJob, row);
  }

  const rows = [...byJob.values()]
    .map(({ lastErrorAt: _lastErrorAt, ...row }) => row)
    .sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));

  return { rows, badLines };
}
