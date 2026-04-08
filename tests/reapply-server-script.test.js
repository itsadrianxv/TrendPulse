import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const scriptPath = path.resolve(process.cwd(), 'scripts', 'reapply-server.sh');

describe('reapply-server.sh', () => {
  it('is a bash script with strict shell options enabled', async () => {
    const content = await fs.readFile(scriptPath, 'utf8');

    expect(content.startsWith('#!/usr/bin/env bash')).toBe(true);
    expect(content).toContain('set -euo pipefail');
  });

  it('declares the fixed production defaults', async () => {
    const content = await fs.readFile(scriptPath, 'utf8');

    expect(content).toContain('REPO_DIR="${REAPPLY_REPO_DIR:-/opt/real-time-fund}"');
    expect(content).toContain('SERVICE_NAME="${REAPPLY_SERVICE_NAME:-fund-alert.service}"');
    expect(content).toContain('BRANCH="${REAPPLY_BRANCH:-main}"');
    expect(content).toContain('RUN_AS="${REAPPLY_RUN_AS:-fundalert}"');
    expect(content).toContain('CONFIG_PATH="${REAPPLY_CONFIG_PATH:-${REPO_DIR}/config/fund-alert.json}"');
  });

  it('contains the required guards and deployment commands in order', async () => {
    const content = await fs.readFile(scriptPath, 'utf8');

    expect(content).toContain('服务器工作树不干净，请先清理后再运行');
    expect(content).toContain('配置文件不存在: $CONFIG_PATH');
    expect(content).toContain('git fetch origin');
    expect(content).toContain('git pull --ff-only origin $(quote_for_bash "$BRANCH")');
    expect(content).toContain("npm ci");
    expect(content).toContain("npm test");
    expect(content).toContain('npm run config:validate -- --config $(quote_for_bash "$CONFIG_PATH")');
    expect(content).toContain('sudo systemctl restart "$SERVICE_NAME"');
    expect(content).toContain('sudo systemctl status "$SERVICE_NAME" --no-pager');

    expect(content.indexOf('git fetch origin')).toBeLessThan(content.indexOf('npm ci'));
    expect(content.indexOf('npm ci')).toBeLessThan(content.indexOf('npm test'));
    expect(content.indexOf('npm test')).toBeLessThan(content.indexOf('sudo systemctl restart "$SERVICE_NAME"'));
  });

  it('supports a self-execution override for test harnesses while keeping production defaults unchanged', async () => {
    const content = await fs.readFile(scriptPath, 'utf8');

    expect(content).toContain('if [ "$RUN_AS" = "__SELF__" ]; then');
    expect(content).toContain('sudo -u "$RUN_AS" -- bash -lc "cd ${escaped_repo} && ${shell_command}"');
  });
});
