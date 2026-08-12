import { describe, expect, it } from 'vitest';
import { computeContainBox, computeCoverBox, computeCustomBox, computeFitBox } from './fit';

describe('computeCoverBox', () => {
  it('横長の動画を縦長キャンバスに合わせると、高さ基準で拡大されキャンバス幅からはみ出す', () => {
    const box = computeCoverBox({ w: 1920, h: 1080 }, { w: 608, h: 1080 });
    expect(box.height).toBeCloseTo(1080);
    expect(box.width).toBeCloseTo(1920);
    expect(box.x).toBeCloseTo((608 - 1920) / 2);
    expect(box.y).toBeCloseTo(0);
  });

  it('動画とキャンバスが同じ縦横比なら、はみ出さずぴったり一致する', () => {
    const box = computeCoverBox({ w: 1920, h: 1080 }, { w: 960, h: 540 });
    expect(box).toEqual({ x: 0, y: 0, width: 960, height: 540 });
  });
});

describe('computeContainBox', () => {
  it('横長の動画を縦長キャンバスに合わせると、幅基準で縮小されレターボックスが生じる', () => {
    const box = computeContainBox({ w: 1920, h: 1080 }, { w: 608, h: 1080 });
    expect(box.width).toBeCloseTo(608);
    expect(box.height).toBeCloseTo(342);
    expect(box.x).toBeCloseTo(0);
    expect(box.y).toBeCloseTo((1080 - 342) / 2);
  });

  it('動画とキャンバスが同じ縦横比なら、余白なくぴったり一致する', () => {
    const box = computeContainBox({ w: 1920, h: 1080 }, { w: 960, h: 540 });
    expect(box).toEqual({ x: 0, y: 0, width: 960, height: 540 });
  });
});

describe('computeCustomBox', () => {
  it('動画を原寸のままキャンバス中央に配置する', () => {
    const box = computeCustomBox({ w: 400, h: 300 }, { w: 1080, h: 608 });
    expect(box).toEqual({ x: (1080 - 400) / 2, y: (608 - 300) / 2, width: 400, height: 300 });
  });
});

describe('computeFitBox', () => {
  const natural = { w: 1920, h: 1080 };
  const canvas = { w: 608, h: 1080 };

  it('modeがcoverならcomputeCoverBoxと同じ結果を返す', () => {
    expect(computeFitBox('cover', natural, canvas)).toEqual(computeCoverBox(natural, canvas));
  });

  it('modeがcontainならcomputeContainBoxと同じ結果を返す', () => {
    expect(computeFitBox('contain', natural, canvas)).toEqual(computeContainBox(natural, canvas));
  });

  it('modeがcustomならcomputeCustomBoxと同じ結果を返す', () => {
    expect(computeFitBox('custom', natural, canvas)).toEqual(computeCustomBox(natural, canvas));
  });
});
