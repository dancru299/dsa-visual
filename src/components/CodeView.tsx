import type { ReactNode } from 'react';
import { cx } from '@/src/lib/cx';
import styles from './CodeView.module.css';

const KEYWORDS = new Set([
  'def',
  'return',
  'while',
  'if',
  'elif',
  'else',
  'for',
  'in',
  'not',
  'and',
  'or',
  'is',
  'True',
  'False',
  'None',
  'import',
  'from',
  'class',
  'pass',
  'break',
  'continue',
  'lambda',
]);

const TOKEN =
  /(#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|(\s+|.)/g;

// Tô màu cú pháp Python đơn giản: từ khoá, tên hàm sau def, số, chuỗi, comment.
export function highlightPython(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let afterDef = false;
  for (const m of line.matchAll(TOKEN)) {
    const [text, comment, str, num, ident] = m;
    let cls: string | undefined;
    if (comment) cls = styles.cm;
    else if (str) cls = styles.str;
    else if (num) cls = styles.nu;
    else if (ident) {
      if (KEYWORDS.has(ident)) cls = styles.kw;
      else if (afterDef) cls = styles.fn;
      afterDef = ident === 'def';
    }
    out.push(
      cls ? (
        <span key={m.index} className={cls}>
          {text}
        </span>
      ) : (
        text
      ),
    );
  }
  return out;
}

type Props = {
  file: string;
  lines: readonly string[];
  highlight?: readonly number[]; // số dòng, bắt đầu từ 1
};

export function CodeView({ file, lines, highlight = [] }: Props) {
  return (
    <div className={styles.code}>
      <div className={styles.head}>
        <i className={styles.dot} />
        <i className={styles.dot} />
        <i className={styles.dot} />
        <span className={styles.file}>{file}</span>
      </div>
      {/* Dòng dài thì cuộn ngang; tabIndex để cuộn được bằng bàn phím (WCAG 2.1.1). */}
      <pre className={styles.pre} tabIndex={0} aria-label={`Code ${file}`}>
        {lines.map((line, i) => (
          <span
            key={i}
            className={cx(styles.ln, highlight.includes(i + 1) && styles.on)}
            data-n={i + 1}
          >
            {highlightPython(line)}
          </span>
        ))}
      </pre>
    </div>
  );
}
