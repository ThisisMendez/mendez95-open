import { readFile } from 'node:fs/promises';
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
export default defineConfig(async () => ({
    plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' }, miniflare: { bindings: { TEST_X_PROFILE: await readFile('worker/fixtures/x-profile.html', 'utf8'), TEST_MIGRATIONS: await readD1Migrations('./worker/migrations'), TEST_CONTENT: Object.fromEntries(await Promise.all(Object.entries({ stories: 'stories', 'field-notes': 'fieldNotes', photos: 'photos', resume: 'resume', about: 'about', elsewhere: 'elsewhere' }).map(async ([name, key]) => [key, JSON.parse(await readFile(`content/${name}.json`, 'utf8'))]))) } } })],
    test: { include: ['worker/**/*.test.ts'], testTimeout: 20000, hookTimeout: 30000 }
}));
