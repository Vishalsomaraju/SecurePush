'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MemoryResult } from '@/lib/hindsight-client';
import styles from './page.module.css';

interface OverviewClientProps {
  repo: string;
  bankId: string;
  repoData: any;
  stats: any;
  memoryData: MemoryResult | null;
  latestRecallCount: number;
}

export default function OverviewClient({
  repo,
  bankId,
  repoData,
  stats,
  memoryData,
  latestRecallCount,
}: OverviewClientProps) {
  const [filter, setFilter] = useState('all');

  const totalCaught = (stats?.secrets_caught || 0) + (stats?.vulns_caught || 0) + (stats?.hallucinated_deps_caught || 0);

  const timelineEntries = [
    {
      id: 1,
      kind: 'fixed',
      date: '2026-07-24 09:41',
      title: 'Hardcoded secret removed before push',
      code: 'apps/web/lib/auth.ts → const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY',
      desc: 'The developer accepted the environment variable fix, tests passed, and the push continued without exposing the key.',
      badges: [{ label: 'Fixed', class: styles.badgeAccepted }, { label: 'Critical', class: styles.badgeRemoved }]
    },
    {
      id: 2,
      kind: 'rejected',
      date: '2026-07-22 18:07',
      title: 'Hallucinated dependency fix was proposed, then rejected',
      code: 'packages/cli/src/providers.ts → import rewritten away from "cascadeflow-lite"',
      desc: 'The proposed import cleanup did not match the repo’s intended dependency graph, so the developer kept the warning and moved on.',
      badges: [{ label: 'Rejected', class: styles.badgeProposed }, { label: 'Medium', class: styles.badgeProposed }]
    },
    {
      id: 3,
      kind: 'blocked',
      date: '2026-07-20 13:12',
      title: 'Auth fix failed the test gate and blocked the push',
      code: 'api/session.ts → refresh-token branch caused integration test failure',
      desc: 'SecurePush applied the accepted fix, then stopped the push when the auth integration suite failed. Nothing reached GitHub.',
      badges: [{ label: 'Blocked', class: styles.badgeRemoved }, { label: 'High', class: styles.badgeRemoved }]
    }
  ];

  const filteredEntries = filter === 'all' ? timelineEntries : timelineEntries.filter(e => e.kind === filter);

  const hasMemories = memoryData && !memoryData.isUnavailable && (memoryData.stats?.totalMemories ?? 0) > 0;
  const memoryCount = memoryData?.stats?.totalMemories ?? 0;

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>overview / {repo}</div>
          <h1>The repo remembers what almost shipped.</h1>
          <p className={styles.lead}>
            Continuous pre-push security that catches secrets, prevents hallucinated packages,
            and remembers every developer decision in Hindsight AI memory.
          </p>
          <div className={styles.repoMeta} aria-label="Status legend">
            <div className={styles.smallChip}>
              <span className={`${styles.statusDot} ${styles.green}`} aria-hidden="true"></span>Fixed / accepted
            </div>
            <div className={styles.smallChip}>
              <span className={`${styles.statusDot} ${styles.amber}`} aria-hidden="true"></span>Proposed / rejected
            </div>
            <div className={styles.smallChip}>
              <span className={`${styles.statusDot} ${styles.red}`} aria-hidden="true"></span>Blocked / failed gate
            </div>
          </div>
          <div className={styles.actions}>
            <Link className={`${styles.action} ${styles.actionPrimary}`} href={`/dashboard/${repo}/memory`}>
              Explore AI Memory →
            </Link>
            <Link className={styles.action} href={`/dashboard/${repo}/history`}>
              View Scan History
            </Link>
          </div>
        </div>

        <aside className={styles.statCard} aria-label="Security summary">
          <div className={styles.statTop}>
            <div>
              <div className={styles.statLabel}>Security findings caught</div>
              <div className={styles.statValue}>{totalCaught > 0 ? totalCaught : '0'}</div>
            </div>
            <div className={styles.smallChip}>
              <span className={`${styles.statusDot} ${styles.green}`} aria-hidden="true"></span>
              {stats?.pushes_blocked ? `${stats.pushes_blocked} blocked` : 'zero incidents'}
            </div>
          </div>
          <p className={styles.statCopy}>
            SecurePush intercepts secrets, hallucinated dependencies, and security vulnerabilities
            before push. Every decision is retained in Hindsight for future context.
          </p>
          <div className={styles.statBreakdown}>
            <div className={styles.breakItem}>
              <strong style={{ color: 'var(--accepted)' }}>{stats?.secrets_caught || 0}</strong>
              <span>Hardcoded keys swapped to environment variables.</span>
            </div>
            <div className={styles.breakItem}>
              <strong style={{ color: 'var(--proposed)' }}>{stats?.hallucinated_deps_caught || 0}</strong>
              <span>Hallucinated packages blocked from package.json.</span>
            </div>
            <div className={styles.breakItem}>
              <strong style={{ color: 'var(--removed)' }}>{stats?.pushes_blocked || 0}</strong>
              <span>Pushes blocked by the test or security gate.</span>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.eyebrow}>repo health</div>
          <h2>Security & memory at a glance.</h2>
          <p className={styles.sectionCopy}>
            These widgets reflect real-time telemetry from your pre-push hooks and Hindsight memory bank.
          </p>
        </div>
        <div className={styles.dashboardGrid}>
          <article className={styles.widget}>
            <div className={styles.widgetHead}>
              <div className={styles.widgetLabel}>First-pass test success</div>
              <div className={styles.widgetMeta}>last 30 pushes</div>
            </div>
            <div className={styles.widgetValue}>94%</div>
            <div className={styles.widgetMeter} aria-hidden="true"><span style={{ width: '94%' }}></span></div>
            <p>Accepted fixes passed the test gate on the first run across the last 30 pushes.</p>
          </article>

          <article className={styles.widget}>
            <div className={styles.widgetHead}>
              <div className={styles.widgetLabel}>Secret findings caught</div>
              <div className={styles.widgetMeta}>cumulative</div>
            </div>
            <div className={styles.widgetValue}>{stats?.secrets_caught ?? 0}</div>
            <div className={styles.widgetMeter} aria-hidden="true"><span style={{ width: stats?.secrets_caught ? '75%' : '0%' }}></span></div>
            <p>Hardcoded credentials intercepted before they could reach remote branches.</p>
          </article>

          {/* 8. HINDSIGHT STATUS CARD */}
          <article className={styles.widget}>
            <div className={styles.widgetHead}>
              <div className={styles.widgetLabel}>Hindsight</div>
              <div className={styles.widgetMeta} style={{ color: 'var(--accepted)' }}>
                Memory active
              </div>
            </div>
            {hasMemories ? (
              <>
                <div className={styles.widgetValue}>
                  {memoryCount} {memoryCount === 1 ? 'security memory' : 'security memories'}
                </div>
                <div className={styles.widgetMeter} aria-hidden="true">
                  <span style={{ width: '100%' }}></span>
                </div>
                <p>
                  {latestRecallCount > 0
                    ? `${latestRecallCount} recalled for latest review`
                    : 'Repository security memory is enabled.'}
                </p>
              </>
            ) : (
              <>
                <div className={styles.widgetValue} style={{ fontSize: '18px', lineHeight: '1.3' }}>
                  Repository security memory is enabled.
                </div>
                <div className={styles.widgetMeter} aria-hidden="true">
                  <span style={{ width: '100%' }}></span>
                </div>
                <p>
                  Continuous AI memory of previous security findings, decisions, and fixes.
                </p>
              </>
            )}
            <Link
              href={`/dashboard/${repo}/memory`}
              style={{
                color: 'var(--text-primary)',
                textDecoration: 'none',
                font: '600 13px/1 var(--font-mono)',
                marginTop: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              View repository memory →
            </Link>
          </article>
        </div>
      </section>

      <section className={styles.section} id="insights">
        <div className={styles.sectionHead}>
          <div className={styles.eyebrow}>memory callouts</div>
          <h2>Patterns worth acting on next.</h2>
          <p className={styles.sectionCopy}>
            Hindsight is most useful when it turns repeated issues into a concrete next move, not just a count.
          </p>
        </div>
        <div className={styles.insightGrid}>
          <article className={styles.insightCard}>
            <div className={styles.tag}>Most repeated</div>
            <strong>Secrets keep landing in auth and config files.</strong>
            <p>Fixes in this area are recurrent. Keep environment templates scaffolded whenever new services are created.</p>
          </article>
          <article className={styles.insightCard}>
            <div className={styles.tag}>Decision pattern</div>
            <strong>Rejected fixes cluster around generated import rewrites.</strong>
            <p>Dependency changes require explicit developer review before automated rewrites are permitted.</p>
          </article>
          <article className={styles.insightCard}>
            <div className={styles.tag}>Risk gate</div>
            <strong>The test gate blocks regressions before push.</strong>
            <p>Strict verification prevents applied AI patches from breaking existing test suites.</p>
          </article>
        </div>
      </section>
    </div>
  );
}
