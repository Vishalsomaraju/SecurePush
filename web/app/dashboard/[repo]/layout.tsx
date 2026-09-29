import GlobalNav from '@/components/GlobalNav';
import GlobalPaymentListener from '@/components/GlobalPaymentListener';
import TabNav from './TabNav';
import styles from './layout.module.css';

export default async function RepoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ repo: string }>;
}) {
  const { repo } = await params;

  return (
    <>
      <GlobalNav />
      <div className={styles.shell}>
        <div className={styles.pageHead}>
          <div className={styles.headerRow}>
            <div className={styles.titleWrapper}>
              <div className={styles.breadcrumb}>
                <a href="/dashboard">dashboard</a> / {repo}
              </div>
              <h1 className={styles.repoName}>{repo}</h1>
            </div>
            <div className={styles.healthBadge}>
              <span>Status</span>
              <span className={styles.healthScore}>Protected</span>
            </div>
          </div>
          <TabNav repo={repo} />
        </div>
        {children}
      </div>
      <GlobalPaymentListener />
    </>
  );
}
