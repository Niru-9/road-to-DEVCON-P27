import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../src/cli.js';
import type { BuiltMarket, Market } from '../src/types.js';

const sample: Market = {
  id: 'test-market',
  question: 'Will the prize pool reach 1,00,000 before June 1, 2025?',
  resolutionRules:
    'Resolves YES if the prize pool reaches 1,00,000 before June 1, 2025.',
  closeDate: '2025-06-01',
  resolutionSource: 'India Meteorological Department',
};

const readBuilt = (p: string): BuiltMarket => JSON.parse(readFileSync(p, 'utf8'));

describe('CLI', () => {
  let workDir: string;
  let previousCwd: string;
  const builtPath = () => join(workDir, 'out', 'test-market.json');

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'bhasha-cli-'));
    previousCwd = process.cwd();
    process.chdir(workDir);
    writeFileSync(join(workDir, 'market.json'), JSON.stringify(sample, null, 2));
  });

  afterEach(() => {
    process.chdir(previousCwd);
    rmSync(workDir, { recursive: true, force: true });
  });

  it('build produces draft out JSON and a review HTML page', async () => {
    const code = await runCli(['build', 'market.json', '--out', 'out']);
    expect(code).toBe(0);

    const built = readBuilt(builtPath());
    expect(built.versions).toHaveLength(3);
    expect(built.versions.every((v) => v.status === 'draft')).toBe(true);
    expect(built.invariants.length).toBeGreaterThan(0);

    const pagePath = join(workDir, 'out', 'test-market.review.html');
    expect(existsSync(pagePath)).toBe(true);
    const page = readFileSync(pagePath, 'utf8');
    expect(page).toContain('test-market');
    expect(page).toContain('English (source)');
    expect(page).toContain('hi');
    expect(page).toContain('ta');
    expect(page).toContain('mr');
  });

  it('publish refuses a version that was never approved', async () => {
    await runCli(['build', 'market.json', '--out', 'out']);
    const code = await runCli(['publish', builtPath(), '--lang', 'hi']);
    expect(code).not.toBe(0);
    expect(readBuilt(builtPath()).versions.find((v) => v.lang === 'hi')!.status).toBe('draft');
  });

  it('approve then publish succeeds, per language', async () => {
    await runCli(['build', 'market.json', '--out', 'out']);
    expect(await runCli(['review', builtPath(), '--approve', 'hi'])).toBe(0);
    expect(await runCli(['publish', builtPath(), '--lang', 'hi'])).toBe(0);

    const built = readBuilt(builtPath());
    expect(built.versions.find((v) => v.lang === 'hi')!.status).toBe('published');
    // the un-approved languages are untouched
    expect(built.versions.find((v) => v.lang === 'ta')!.status).toBe('draft');
    expect(built.versions.find((v) => v.lang === 'mr')!.status).toBe('draft');
  });

  it('approval is refused while a check is failing, and --fix repairs it', async () => {
    await runCli(['build', 'market.json', '--corrupt', '--out', 'out']);
    expect(readBuilt(builtPath()).versions.every((v) => v.status === 'blocked')).toBe(true);
    expect(await runCli(['review', builtPath(), '--approve', 'hi'])).not.toBe(0);

    // repair hi by hand: restore the English number and relation wording
    const built = readBuilt(builtPath());
    const hi = built.versions.find((v) => v.lang === 'hi')!;
    const fixedQuestion = hi.values.question
      .replaceAll('10,00,000', '1,00,000')
      .replaceAll('तक', 'से पहले');
    const fixedRules = hi.values.resolutionRules
      .replaceAll('10,00,000', '1,00,000')
      .replaceAll('तक', 'से पहले');
    expect(
      await runCli(['review', builtPath(), '--fix', `hi:question=${fixedQuestion}`]),
    ).toBe(0);
    expect(
      await runCli(['review', builtPath(), '--fix', `hi:resolutionRules=${fixedRules}`]),
    ).toBe(0);
    expect(await runCli(['review', builtPath(), '--approve', 'hi'])).toBe(0);
    expect(await runCli(['publish', builtPath(), '--lang', 'hi'])).toBe(0);
    expect(readBuilt(builtPath()).versions.find((v) => v.lang === 'hi')!.status).toBe(
      'published',
    );
  });
});
