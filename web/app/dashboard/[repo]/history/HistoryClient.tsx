'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface HistoryClientProps {
  repo: string;
  repoData: any;
  stats: any;
  history: any[];
}

export default function HistoryClient({ repo, repoData, stats, history }: HistoryClientProps) {
  const [filter, setFilter] = useState('all');

  const filteredHistory = history.filter(item => {
    if (filter === 'all') return true;
    return item.kind === filter;
  });

  const totalCaught = (stats?.secrets_caught || 0) + (stats?.vulns_caught || 0) + (stats?.hallucinated_deps_caught || 0);

  return (
    <div>
      <section className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>SCAN HISTORY FOR {repo}</div>
          <h1 className={styles.heroTitle}>What happened in this repository.</h1>
          <p className={styles.lead}>
            A chronological record of push scans, gate decisions, and applied remediations. 
            To view what the AI agent has learned, retained, and recalled across reviews, check the{' '}
            <Link href={`/dashboard/${repo}/memory`} style={{ color: 'var(--text-primary)', textDecoration: 'underline' }}>
              Memory
            </Link>{' '}
            tab.
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
            <a className={`${styles.action} ${styles.actionPrimary}`} href="#timeline">Review timeline</a>
            <Link className={styles.action} href={`/dashboard/${repo}/memory`}>View AI Memory →</Link>
          </div>
        </div>

        <aside className={styles.statCard} aria-label="Scan summary">
          <div className={styles.statTop}>
            <div>
              <div className={styles.statLabel}>Security findings caught</div>
              <div className={styles.statValue}>{totalCaught}</div>
            </div>
            <div className={styles.smallChip}>
              <span className={`${styles.statusDot} ${styles.green}`} aria-hidden="true"></span>
              {stats?.pushes_blocked ? `${stats.pushes_blocked} blocked` : 'zero incidents'}
            </div>
          </div>
          <p className={styles.statCopy}>
            SecurePush has inspected <strong>{stats?.total_scans || 0} push attempts</strong> in this repository, catching{' '}
            <strong>{stats?.secrets_caught || 0} secrets</strong>,{' '}
            <strong>{stats?.hallucinated_deps_caught || 0} dependency issues</strong>, and{' '}
            <strong>{stats?.vulns_caught || 0} other vulnerabilities</strong> before push.
          </p>
          <div className={styles.statBreakdown}>
            <div className={styles.breakItem}>
              <strong style={{ color: 'var(--accepted)' }}>{stats?.secrets_caught || 0}</strong>
              <span>Hardcoded secrets intercepted.</span>
            </div>
            <div className={styles.breakItem}>
              <strong style={{ color: 'var(--proposed)' }}>{stats?.hallucinated_deps_caught || 0}</strong>
              <span>Hallucinated packages blocked before package.json.</span>
            </div>
            <div className={styles.breakItem}>
              <strong style={{ color: 'var(--removed)' }}>{stats?.pushes_blocked || 0}</strong>
              <span>Push events stopped at the security gate.</span>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.section} id="timeline">
        <div className={styles.sectionHead}>
          <div className={styles.eyebrow}>terminal log</div>
          <h2>Chronological scan history.</h2>
          <p className={styles.sectionCopy}>
            Monospace timestamps, file-path formatting, and action labels make the sequence readable like a real git log.
          </p>
        </div>
        <div className={styles.filters} role="toolbar" aria-label="Timeline filters">
          <button className={`${styles.filter} ${filter === 'all' ? styles.filterActive : ''}`} type="button" onClick={() => setFilter('all')}>
            All findings ({history.length})
          </button>
          <button className={`${styles.filter} ${filter === 'fixed' ? styles.filterActive : ''}`} type="button" onClick={() => setFilter('fixed')}>
            Fixed
          </button>
          <button className={`${styles.filter} ${filter === 'rejected' ? styles.filterActive : ''}`} type="button" onClick={() => setFilter('rejected')}>
            Rejected
          </button>
          <button className={`${styles.filter} ${filter === 'blocked' ? styles.filterActive : ''}`} type="button" onClick={() => setFilter('blocked')}>
            Blocked
          </button>
        </div>
        
        <div className={styles.timeline}>
          {filteredHistory.length > 0 ? (
            filteredHistory.map((item, index) => {
              const kind = item.kind || 'fixed';
              const badgeClass = kind === 'fixed' ? styles.badgeAccepted : kind === 'rejected' ? styles.badgeProposed : styles.badgeRemoved;
              const severityBadge = kind === 'fixed' ? styles.badgeRemoved : kind === 'rejected' ? styles.badgeProposed : styles.badgeNeutral;
              const severityText = item.severity || (kind === 'fixed' ? 'Critical' : kind === 'rejected' ? 'Medium' : 'High');
              
              return (
                <article key={item.id || index} className={styles.entry} data-kind={kind}>
                  <div className={styles.timelineHead}>
                    <div>
                      <div className={styles.timelineMeta}>
                        {item.timestamp ? new Date(item.timestamp).toISOString().replace('T', ' ').substring(0, 16) + ' UTC' : 'Recorded'} / {repo}
                      </div>
                      <h3>{item.title || 'Security scan event'}</h3>
                    </div>
                    <div className={styles.badgeRow}>
                      <span className={`${styles.badge} ${badgeClass}`}>
                        {kind === 'fixed' ? 'Fixed' : kind === 'rejected' ? 'Rejected' : 'Blocked'}
                      </span>
                      <span className={`${styles.badge} ${severityBadge}`}>{severityText}</span>
                    </div>
                  </div>
                  {item.codeContext && (
                    <div className={styles.timelineCode}>
                      {item.codeContext}
                    </div>
                  )}
                  <p>
                    {item.text || 'Security finding evaluated during pre-push scan.'}
                  </p>
                </article>
              );
            })
          ) : (
            <div style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📋</div>
              <h3 style={{ margin: '0 0 6px 0', fontFamily: 'var(--font-display)', fontSize: '18px' }}>No scan history recorded yet.</h3>
              <p style={{ margin: '0', color: 'var(--text-muted)', fontSize: '14px' }}>
                Run <code>securepush init</code> and push code to log security gate results. To view AI memory, visit the{' '}
                <Link href={`/dashboard/${repo}/memory`} style={{ color: 'var(--text-primary)', textDecoration: 'underline' }}>
                  Memory tab
                </Link>.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
