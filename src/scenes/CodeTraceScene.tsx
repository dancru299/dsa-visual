import { CodeView } from '@/src/components/CodeView';
import type { SceneComponent, SceneProps } from '@/src/engine/types';
import { cx } from '@/src/lib/cx';
import styles from './CodeTraceScene.module.css';

// Scene dùng chung cho bước tóm tắt của mọi bài: đoạn code bên trái, bảng trace bên phải.
// Dòng code đang chạy lấy từ frame.codeLines; các hàng của bảng lấy từ state.rows.
export type CodeTraceState = { rows: string[][] };

type Options = {
  file: string;
  code: readonly string[];
  columns: readonly string[];
  title: string;
};

export function codeTraceScene({
  file,
  code,
  columns,
  title,
}: Options): SceneComponent<CodeTraceState> {
  function CodeTraceScene({ frame, animate }: SceneProps<CodeTraceState>) {
    const { rows } = frame.state;
    return (
      <div className={cx(styles.root, !animate && styles.noAnim)}>
        <div className={styles.codeCol}>
          <CodeView file={file} lines={code} highlight={frame.codeLines} />
        </div>
        <div className={styles.trace}>
          <div className={styles.title}>{title}</div>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr className={styles.empty}>
                    <td colSpan={columns.length}>(chưa chạy vòng nào)</td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={i} className={styles.row}>
                      {r.map((cell, j) => (
                        <td key={j}>{cell}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
  return CodeTraceScene;
}
