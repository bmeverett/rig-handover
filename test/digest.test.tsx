import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

function appWith(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), body);
  }
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir: dir,
  });
}

function line(entry: { at: string; job: string; status: 'ok' | 'retry' | 'fail'; owner: string | null }) {
  return JSON.stringify(entry);
}

function pageJobs(html: string): string[] {
  const body = html.split('<tbody>')[1]?.split('</tbody>')[0] ?? '';
  return [...body.matchAll(/<tr[^>]*>\s*<td>([^<]*)<\/td>/g)].map((match) => match[1] ?? '');
}

describe('digest routes', () => {
  it('returns 200 and the same jobs in the same order', async () => {
    const app = appWith({
      '2026-10-28.jsonl':
        [
          line({ at: '2026-10-28T23:00:06+01:00', job: 'lane/sync', status: 'ok', owner: 'rook' }),
          line({ at: '2026-10-28T23:00:02+01:00', job: 'rig/rotate-logs', status: 'ok', owner: 'lane-07' }),
        ].join('\n') + '\n',
    });

    const page = await app.request('/digest/2026-10-28');
    const html = await page.text();
    const json = await app.request('/api/digest/2026-10-28');
    const rows = (await json.json()) as DigestRow[];

    expect(page.status).toBe(200);
    expect(json.status).toBe(200);
    expect(pageJobs(html)).toEqual(['lane/sync', 'rig/rotate-logs']);
    expect(rows.map((row) => row.job)).toEqual(pageJobs(html));
  });

  it('returns 404 when the night has no file', async () => {
    const app = appWith({});
    expect((await app.request('/digest/2026-10-28')).status).toBe(404);
    expect((await app.request('/api/digest/2026-10-28')).status).toBe(404);
  });

  it('renders nothing ran for an empty night', async () => {
    const app = appWith({ '2026-10-28.jsonl': '' });
    const page = await app.request('/digest/2026-10-28');
    const html = await page.text();
    const rows = await (await app.request('/api/digest/2026-10-28')).json();

    expect(page.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(rows).toEqual([]);
  });

  it('renders a night that contains a bad line', async () => {
    const app = appWith({
      '2026-10-28.jsonl':
        line({ at: '2026-10-28T23:00:02+01:00', job: 'rig/rotate-logs', status: 'ok', owner: 'lane-07' }) +
        '\n{"at":"2026-10-29T05:59:58+01:00","job":"lane/sy\n',
    });
    const page = await app.request('/digest/2026-10-28');
    const html = await page.text();
    const rows = (await (await app.request('/api/digest/2026-10-28')).json()) as DigestRow[];

    expect(page.status).toBe(200);
    expect(html).toContain('rig/rotate-logs');
    expect(html).not.toContain('nothing ran');
    expect(rows.map((row) => row.job)).toEqual(pageJobs(html));
  });
});
