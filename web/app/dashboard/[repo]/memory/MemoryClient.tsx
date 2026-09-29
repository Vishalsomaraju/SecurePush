'use client';

import { useState } from 'react';
import { SecurityMemory, MemoryResult } from '@/lib/hindsight-client';
import styles from './page.module.css';

interface MemoryClientProps {
  repo: string;
  bankId: string;
  memoryResult: MemoryResult;
  latestRecall: string[];
  memoryUpdated: boolean;
  recalledAt?: string;
  lastScanAt?: string;
}

interface ParsedMemory {
  id?: string;
  decision?: 'accepted' | 'rejected';
  severity?: 'critical' | 'high' | 'medium' | 'low';
  issue?: string;
  file?: string;
  testOutcome?: string;
  text: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

function parseMemory(m: SecurityMemory): ParsedMemory {
  const text = m.text || '';
  const textLower = text.toLowerCase();
  const meta = m.metadata || {};

  // Developer Decision
  let decision: 'accepted' | 'rejected' | undefined = undefined;
  const rawDec = String(meta.decision || meta.action || '').toLowerCase();
  if (rawDec === 'accepted' || rawDec === 'fixed' || textLower.includes('developer accepted')) {
    decision = 'accepted';
  } else if (rawDec === 'rejected' || rawDec === 'blocked' || textLower.includes('developer rejected')) {
    decision = 'rejected';
  }

  // Severity
  let severity: 'critical' | 'high' | 'medium' | 'low' | undefined = undefined;
  const rawSev = String(meta.severity || '').toLowerCase();
  if (rawSev === 'critical' || textLower.includes('(critical)')) severity = 'critical';
  else if (rawSev === 'high' || textLower.includes('(high)')) severity = 'high';
  else if (rawSev === 'medium' || textLower.includes('(medium)')) severity = 'medium';
  else if (rawSev === 'low' || textLower.includes('(low)')) severity = 'low';

  // Issue / Pattern
  let issue = typeof meta.issue === 'string' ? meta.issue : undefined;
  if (!issue) {
    if (textLower.includes('hardcoded_secret') || textLower.includes('hardcoded secret') || textLower.includes('credential')) {
      issue = 'Hardcoded Secret';
    } else if (textLower.includes('hallucinated_dependency') || textLower.includes('hallucinated dependency')) {
      issue = 'Hallucinated Dependency';
    } else if (textLower.includes('sql_injection') || textLower.includes('sql injection')) {
      issue = 'SQL Injection';
    } else if (textLower.includes('insecure_auth') || textLower.includes('auth')) {
      issue = 'Auth Vulnerability';
    }
  } else {
    // Format issue code to title case
    issue = issue.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // File
  let file = typeof meta.file === 'string' ? meta.file : undefined;
  if (!file) {
    const fileMatch = text.match(/(?:in|file)\s+([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)/i);
    if (fileMatch) file = fileMatch[1];
  }

  // Test Outcome
  let testOutcome = typeof meta.testOutcome === 'string' ? meta.testOutcome : undefined;
  if (!testOutcome) {
    if (textLower.includes('tests passed')) testOutcome = 'Tests passed';
    else if (textLower.includes('tests failed')) testOutcome = 'Tests failed';
  } else {
    testOutcome = testOutcome.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  return {
    id: m.id,
    decision,
    severity,
    issue,
    file,
    testOutcome,
    text,
    timestamp: m.timestamp,
    metadata: m.metadata,
  };
}

function formatTimestamp(ts?: string): string | null {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
  } catch {
    return null;
  }
}

export default function MemoryClient({
  repo,
  bankId,
  memoryResult,
  latestRecall,
  memoryUpdated,
  recalledAt,
}: MemoryClientProps) {
  const [filter, setFilter] = useState<'all' | 'accepted' | 'rejected'>('all');

  const { memories = [], stats, isUnavailable } = memoryResult;
  const parsedMemories = memories.map(parseMemory);

  const filteredMemories = parsedMemories.filter((mem) => {
    if (filter === 'all') return true;
    return mem.decision === filter;
  });

  return (
    <div className={styles.page}>
      {/* A. HEADER */}
      <section className={styles.hero}>
        <div className={styles.eyebrow}>HINDSIGHT MEMORY</div>
        <h1 className={styles.heroTitle}>What SecurePush remembers.</h1>
        <p className={styles.lead}>
          A repository-specific memory of previous security findings, developer decisions, fixes, and test outcomes. SecurePush recalls relevant memories during future reviews.
        </p>

        {/* C. MEMORY BANK */}
        <div className={styles.bankBar}>
          <span className={styles.bankLabel}>Memory bank</span>
          <span className={styles.bankId}>{bankId}</span>
        </div>
      </section>

      {/* MEMORY UPDATED STATE */}
      {memoryUpdated && (
        <div className={styles.updatedBanner}>
          <span className={styles.updatedDot} />
          <div>
            <strong>Memory updated</strong>
            <span style={{ margin: '0 8px', opacity: 0.5 }}>—</span>
            <span style={{ color: 'var(--text-muted)' }}>
              SecurePush remembered this decision for future reviews.
            </span>
          </div>
        </div>
      )}

      {/* 4. RECALLED FOR THIS REVIEW */}
      {latestRecall && latestRecall.length > 0 && (
        <section className={styles.recalledSection}>
          <div className={styles.recalledHead}>
            <span className={styles.recalledTitle}>Recalled for this review</span>
            <span className={styles.recalledCount}>
              {latestRecall.length} {latestRecall.length === 1 ? 'relevant memory' : 'relevant memories'}
            </span>
          </div>
          <div className={styles.recalledList}>
            {latestRecall.map((item, idx) => (
              <div key={idx} className={styles.recalledItem}>
                {item}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* B. MEMORY SUMMARY */}
      {!isUnavailable && stats && stats.totalMemories > 0 && (
        <section className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Memories stored</div>
            <div className={styles.statValue}>{stats.totalMemories}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Security decisions</div>
            <div className={styles.statValue}>{stats.decisions}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Accepted fixes</div>
            <div className={styles.statValue} style={{ color: 'var(--accepted)' }}>
              {stats.accepted}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Rejected fixes</div>
            <div className={styles.statValue} style={{ color: 'var(--proposed)' }}>
              {stats.rejected}
            </div>
          </div>
        </section>
      )}

      {/* HINDSIGHT FAILURE STATE */}
      {isUnavailable ? (
        <div className={styles.unavailableState}>
          <h3 className={styles.unavailableTitle}>Memory temporarily unavailable</h3>
          <p className={styles.unavailableDesc}>
            SecurePush security scanning continues independently of Hindsight.
          </p>
        </div>
      ) : parsedMemories.length === 0 ? (
        /* E. EMPTY STATE */
        <div className={styles.emptyState}>
          <div style={{ fontSize: '28px' }}>🧠</div>
          <h3 className={styles.emptyTitle}>No security memories yet.</h3>
          <p className={styles.emptyDesc}>
            SecurePush will remember security findings and developer decisions after the first reviewed push.
          </p>
        </div>
      ) : (
        /* D. MEMORY LIST */
        <section>
          <div className={styles.filters} role="toolbar" aria-label="Memory filters">
            <button
              type="button"
              className={`${styles.filter} ${filter === 'all' ? styles.filterActive : ''}`}
              onClick={() => setFilter('all')}
            >
              All memories ({parsedMemories.length})
            </button>
            <button
              type="button"
              className={`${styles.filter} ${filter === 'accepted' ? styles.filterActive : ''}`}
              onClick={() => setFilter('accepted')}
            >
              Accepted ({stats?.accepted ?? 0})
            </button>
            <button
              type="button"
              className={`${styles.filter} ${filter === 'rejected' ? styles.filterActive : ''}`}
              onClick={() => setFilter('rejected')}
            >
              Rejected ({stats?.rejected ?? 0})
            </button>
          </div>

          <div className={styles.memoryList}>
            {filteredMemories.length > 0 ? (
              filteredMemories.map((mem, idx) => {
                const formattedTime = formatTimestamp(mem.timestamp);
                return (
                  <article key={mem.id || idx} className={styles.memoryCard}>
                    <div className={styles.memoryHeader}>
                      <div className={styles.memoryBadges}>
                        {mem.decision === 'accepted' && (
                          <span className={`${styles.badge} ${styles.badgeAccepted}`}>
                            Accepted fix
                          </span>
                        )}
                        {mem.decision === 'rejected' && (
                          <span className={`${styles.badge} ${styles.badgeRejected}`}>
                            Rejected fix
                          </span>
                        )}
                        {mem.severity === 'critical' && (
                          <span className={`${styles.badge} ${styles.badgeCritical}`}>
                            Critical
                          </span>
                        )}
                        {mem.severity === 'high' && (
                          <span className={`${styles.badge} ${styles.badgeHigh}`}>
                            High
                          </span>
                        )}
                        {mem.severity === 'medium' && (
                          <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                            Medium
                          </span>
                        )}
                        {mem.severity === 'low' && (
                          <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                            Low
                          </span>
                        )}
                        {mem.issue && (
                          <span className={`${styles.badge} ${styles.badgeNeutral}`}>
                            {mem.issue}
                          </span>
                        )}
                      </div>
                      {formattedTime && (
                        <span className={styles.memoryTimestamp}>{formattedTime}</span>
                      )}
                    </div>

                    <p className={styles.memoryText}>{mem.text}</p>

                    {(mem.file || mem.testOutcome) && (
                      <div className={styles.memoryMeta}>
                        {mem.file && (
                          <div className={styles.metaItem}>
                            <span className={styles.metaKey}>File:</span>
                            <span>{mem.file}</span>
                          </div>
                        )}
                        {mem.testOutcome && (
                          <div className={styles.metaItem}>
                            <span className={styles.metaKey}>Tests:</span>
                            <span>{mem.testOutcome}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })
            ) : (
              <div style={{ padding: '24px', color: 'var(--text-muted)' }}>
                No memories match the selected filter.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
