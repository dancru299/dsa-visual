import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>
        DSA <span className={styles.highlight}>Visual</span>
      </h1>
      <p className={styles.lead}>
        Học cấu trúc dữ liệu và giải thuật bằng animation, dành cho người học Data Engineering.
      </p>
      <div className={styles.card}>
        <p>
          Trang đang được xây dựng. Trong lúc chờ, bạn có thể xem{' '}
          <a href="/demo.html">bản demo đầu tiên</a> với hai bài Binary Search và Stack.
        </p>
      </div>
    </main>
  );
}
