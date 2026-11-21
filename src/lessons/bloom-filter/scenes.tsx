'use client';

import { CodeView } from '@/src/components/CodeView';
import type { SceneComponent, SceneProps } from '@/src/engine/types';
import { cx } from '@/src/lib/cx';
import type { BloomState, ScanState } from './algorithm';
import styles from './scenes.module.css';

type Code = { file: string; lines: readonly string[] };

function Verdict({ verdict, truth }: { verdict: BloomState['verdict']; truth: boolean | null }) {
  if (verdict === null) return null;
  const label = verdict === 'absent' ? 'CHẮC CHẮN KHÔNG CÓ' : 'CÓ THỂ CÓ';
  const note =
    truth === null
      ? null
      : verdict === 'maybe'
        ? truth
          ? 'có thật'
          : 'dương tính giả'
        : truth
          ? 'âm tính giả: sai!'
          : 'đúng';
  const bad = (verdict === 'maybe' && truth === false) || (verdict === 'absent' && truth === true);
  return (
    <div className={styles.verdictRow} data-testid="bloom-verdict">
      <span className={cx(styles.verdict, verdict === 'absent' ? styles.absent : styles.maybe)}>
        {label}
      </span>
      {note && <span className={cx(styles.note, bad && styles.noteBad)}>thực tế: {note}</span>}
    </div>
  );
}

// Mảng bit của một Bloom filter, cùng phần tử đang thêm, kiểm tra hoặc xoá.
export function bloomScene({
  title,
  code,
}: {
  title: string;
  code: Code;
}): SceneComponent<BloomState> {
  function BloomScene({ frame, animate }: SceneProps<BloomState>) {
    const s = frame.state;
    return (
      <div className={cx(styles.root, !animate && styles.noAnim)} data-testid="bloom-scene">
        <div className={styles.main}>
          <div className={styles.card}>
            <div className={styles.head}>
              <span>{title}</span>
              <span className={styles.muted}>
                {s.m} bit · {s.k} hàm hash · {s.bits.filter((b) => b === 1).length} bit đang bật
              </span>
            </div>
            <div className={styles.item}>
              {s.item === null ? (
                <span className={styles.muted}>(chưa có phần tử nào đang xét)</span>
              ) : (
                <>
                  <span className={styles.itemName}>&quot;{s.item}&quot;</span>
                  {s.positions.map((p, i) => (
                    <span key={i} className={cx(styles.hash, s.probe === p && styles.hashOn)}>
                      h{i + 1} → {p}
                    </span>
                  ))}
                </>
              )}
            </div>
            <div className={styles.bits}>
              {s.bits.map((b, i) => (
                <div
                  key={i}
                  className={cx(
                    styles.bit,
                    b === 1 && styles.on,
                    s.positions.includes(i) && styles.target,
                    s.probe === i && styles.probe,
                    s.cleared.includes(i) && styles.cleared,
                  )}
                  data-bit={i}
                >
                  <span className={styles.val}>{b}</span>
                  <span className={styles.idx}>{i}</span>
                </div>
              ))}
            </div>
            <Verdict verdict={s.verdict} truth={s.truth} />
          </div>

          {frame.say && (
            <div
              key={frame.say}
              className={cx(styles.say, frame.sayTone && styles[frame.sayTone])}
              role="status"
            >
              {frame.say}
            </div>
          )}
        </div>

        <div className={styles.side}>
          <div className={styles.card}>
            <div className={styles.head}>
              <span>TẬP THẬT SỰ</span>
              <span className={styles.muted}>filter không lưu danh sách này</span>
            </div>
            <div className={styles.chips}>
              {s.added.map((x) => (
                <span key={x} className={styles.chip}>
                  {x}
                </span>
              ))}
            </div>
          </div>
          <CodeView file={code.file} lines={code.lines} highlight={frame.codeLines} />
        </div>
      </div>
    );
  }
  return BloomScene;
}

// Các row group của một file Parquet, mỗi row group có Bloom filter riêng cho cột cần tìm.
export function rowGroupScene({ code }: { code: Code }): SceneComponent<ScanState> {
  function RowGroupScene({ frame, animate }: SceneProps<ScanState>) {
    const s = frame.state;
    return (
      <div className={cx(styles.root, !animate && styles.noAnim)} data-testid="rowgroup-scene">
        <div className={styles.main}>
          <div className={styles.card}>
            <div className={styles.head}>
              <span>orders.parquet</span>
              <span className={styles.muted}>
                WHERE customer_id = &apos;{s.query}&apos; · bit {s.positions.join(', ')}
              </span>
            </div>
            <div className={styles.groups}>
              {s.groups.map((g, i) => {
                const v = s.verdicts[i];
                const found = s.found[i];
                return (
                  <div
                    key={g.name}
                    className={cx(
                      styles.group,
                      s.current === i && styles.groupOn,
                      v === 'absent' && styles.skipped,
                    )}
                    data-testid="row-group"
                  >
                    <div className={styles.groupHead}>
                      <b>{g.name}</b>
                      <span className={styles.muted}>{g.keys.length} khách</span>
                    </div>
                    <div className={styles.mini}>
                      {g.bits.map((b, j) => (
                        <span
                          key={j}
                          className={cx(
                            styles.miniBit,
                            b === 1 && styles.on,
                            s.positions.includes(j) && styles.target,
                            s.positions.includes(j) && b === 0 && v !== null && styles.zero,
                          )}
                        />
                      ))}
                    </div>
                    <div className={styles.groupFoot}>
                      {v === null && <span className={styles.muted}>chưa xét</span>}
                      {v === 'absent' && <span className={styles.tagSkip}>bỏ qua, không đọc</span>}
                      {v === 'maybe' && found === null && (
                        <span className={styles.tagRead}>có thể có: đọc</span>
                      )}
                      {found === true && <span className={styles.tagHit}>đọc: có {s.query}</span>}
                      {found === false && (
                        <span className={styles.tagMiss}>đọc: không có, dương tính giả</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {frame.say && (
            <div
              key={frame.say}
              className={cx(styles.say, frame.sayTone && styles[frame.sayTone])}
              role="status"
            >
              {frame.say}
            </div>
          )}
        </div>
        <div className={styles.side}>
          <CodeView file={code.file} lines={code.lines} highlight={frame.codeLines} />
        </div>
      </div>
    );
  }
  return RowGroupScene;
}
