'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './layout.module.css';

export default function TabNav({ repo }: { repo: string }) {
  const pathname = usePathname();
  const baseUrl = `/dashboard/${repo}`;

  const tabs = [
    { name: 'Overview', path: baseUrl },
    { name: 'Memory', path: `${baseUrl}/memory` },
    { name: 'History', path: `${baseUrl}/history` },
    { name: 'Insights', path: `${baseUrl}/insights` },
    { name: 'Settings', path: `${baseUrl}/settings` },
  ];

  return (
    <nav className={styles.tabNav}>
      {tabs.map((tab) => (
        <Link
          key={tab.name}
          href={tab.path}
          className={`${styles.tab} ${pathname === tab.path ? styles.tabActive : ''}`}
        >
          {tab.name}
        </Link>
      ))}
    </nav>
  );
}
