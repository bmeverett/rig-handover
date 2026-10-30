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

/** Read `runsDir/<night>.jsonl`. A missing file throws. */
export function readNight(_runsDir: string, _night: string): NightDigest {
  throw new Error('readNight is not implemented');
}
