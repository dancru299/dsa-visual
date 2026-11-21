import type { ButtonHTMLAttributes } from 'react';
import { cx } from '@/src/lib/cx';
import styles from './Button.module.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary';
  size?: 'default' | 'small';
};

export function Button({ variant = 'default', size = 'default', className, ...rest }: Props) {
  return (
    <button
      type="button"
      className={cx(
        styles.btn,
        variant === 'primary' && styles.primary,
        size === 'small' && styles.small,
        className,
      )}
      {...rest}
    />
  );
}

export const buttonClass = (variant: 'default' | 'primary' = 'default') =>
  cx(styles.btn, variant === 'primary' && styles.primary);
