import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { countByStatus } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type NightOnDisk = {
  night: string;
  ok: number;
  retry: number;
  fail: number;
};

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightOnDisk[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((night) => {
      try {
        return { night, ...countByStatus(config.runsDir, night) };
      } catch {
        return { night, ok: 0, retry: 0, fail: 0 };
      }
    }),
  };
}
