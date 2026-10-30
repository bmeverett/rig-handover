import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight, type NightDigest } from './digest/types.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

function isEnoent(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err && err.code === 'ENOENT';
}

export function loadDigest(runsDir: string, night: string): NightDigest | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return undefined;
  try {
    return readNight(runsDir, night);
  } catch (err) {
    if (isEnoent(err)) return undefined;
    throw err;
  }
}

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const digest = loadDigest(config.runsDir, c.req.param('night'));
    if (!digest) return c.notFound();
    return c.html(
      <Layout title="digest" lane={lane()}>
        <DigestPage digest={digest} />
      </Layout>,
    );
  });

  return app;
}
