import { describe, expect, it } from 'vitest';
import { tunables } from '../src/config';
import { judge, judgeNoRoar } from '../src/game/houtui/judge';
import { getTitle } from '../src/game/houtui/schedule';

const config = tunables.judge;

describe('judge §3.4', () => {
  it('四档窗口边界', () => {
    expect(judge(0, config).result).toBe('too_early');
    expect(judge(0.699, config).result).toBe('too_early');
    expect(judge(0.7, config).result).toBe('repel');
    expect(judge(0.859, config).result).toBe('repel');
    expect(judge(0.86, config).result).toBe('perfect');
    expect(judge(0.949, config).result).toBe('perfect');
    expect(judge(0.95, config).result).toBe('too_late');
    expect(judge(1, config).result).toBe('too_late');
  });

  it('得分与四档一致', () => {
    expect(judge(0.5, config).score).toBe(0);
    expect(judge(0.75, config).score).toBe(1);
    expect(judge(0.9, config).score).toBe(2);
    expect(judge(0.99, config).score).toBe(0);
    expect(judgeNoRoar(config).score).toBe(0);
  });

  it('3 号假冲 p≤0.66 时吼 = 太早', () => {
    expect(judge(0.66, config).result).toBe('too_early');
  });
});

describe('称号文案锁定', () => {
  it.each([
    [0, '糊了一脸'],
    [1, '差点吓住'],
    [2, '差点吓住'],
    [3, '一嗓镇场'],
    [4, '一嗓镇场'],
    [5, '狮吼功'],
    [6, '吼神本神'],
  ])('%i 分 → %s', (score, title) => {
    expect(getTitle(score, tunables.score.titles)).toBe(title);
  });
});
