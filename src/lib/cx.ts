// Ghép tên class, bỏ qua các giá trị rỗng: cx(styles.cell, isMid && styles.mid).
export const cx = (...names: (string | false | null | undefined)[]) =>
  names.filter(Boolean).join(' ');
