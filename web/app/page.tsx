

import Hero from '@/components/Hero';
import Link from 'next/link';
import GlobalNav from '@/components/GlobalNav';
import './page.css';

export const metadata = {
  title: 'SecurePush | Review AI code before it reaches GitHub',
};

export default function Home() {
  return (
    <>
      <GlobalNav />   
      <main className="page" style={{ padding: 0 }}>
      

      <Hero />

      <section className="flow-section" id="flow">
        <div className="section-head">
          <div className="eyebrow">real sequence</div>
          <h2>Scan, decide, then ship.</h2>
          <p className="section-copy">
            The numbered steps are justified here because they are the literal
            order of operations. SecurePush only scans the changed diff, waits
            for the developer to decide on each fix, then gates the push on the
            test run.
          </p>
        </div>
        <div className="steps">
          <article className="step">
            <div className="step-index">01</div>
            <h3>Scan</h3>
            <p>
              Intercept <code>git push</code>, diff the changed files since the
              upstream branch, and review only what the agent touched.
            </p>
            <ul>
              <li>
                <strong>Removed</strong> marks the risky line that should not
                ship.
              </li>
              <li>
                <strong>Critical secrets</strong> stay visible instead of
                disappearing into a report.
              </li>
            </ul>
          </article>
          <article className="step">
            <div className="step-index">02</div>
            <h3>Decide</h3>
            <p>
              Show each proposed fix in amber first. The developer accepts or
              rejects line by line instead of trusting a blind auto-fix.
            </p>
            <ul>
              <li>
                <strong>Proposed</strong> means the fix is waiting for a
                decision.
              </li>
              <li>
                <strong>Fixed</strong> appears only after the developer accepts
                it.
              </li>
            </ul>
          </article>
          <article className="step">
            <div className="step-index">03</div>
            <h3>Ship</h3>
            <p>
              Accepted fixes are committed, the configured test command runs,
              and only a passing run allows the push to proceed.
            </p>
            <ul>
              <li>
                <strong>Pass</strong> means the push continues automatically.
              </li>
              <li>
                <strong>Fail</strong> blocks the push before GitHub changes.
              </li>
            </ul>
          </article>
        </div>
      </section>

      <section id="comparison">
        <div className="section-head">
          <div className="eyebrow">unified, not first</div>
          <h2>
            Adjacent tools cover fragments of the sequence. SecurePush keeps the
            row intact.
          </h2>
          <p className="section-copy">
            The point is not novelty theater. Review, fix loops, test gates, and
            secret scanning already exist in fragments. The argument here is
            that SecurePush keeps that sequence in one place, adds a visible
            accept-or-reject step, and remembers what happened in this repo over
            time.
          </p>
        </div>
        <div className="comparison-wrap">
          <div
            className="comparison-grid"
            role="table"
            aria-label="Comparison across adjacent tools"
          >
            <div className="grid-head" role="row">
              <div role="columnheader">Tool</div>
              <div role="columnheader">Review</div>
              <div role="columnheader">Fix</div>
              <div role="columnheader">Test-gate</div>
              <div role="columnheader">Memory</div>
            </div>

            <div className="grid-row" role="row">
              <div className="tool" role="rowheader">
                GitGuardian<small>secret scanner</small>
              </div>
              <div className="status-cell present">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>Review</span><span>secret check</span>
                </div>
              </div>
              <div className="status-cell empty">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>No fix</span><span>report only</span>
                </div>
              </div>
              <div className="status-cell empty">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>No gate</span><span>manual next step</span>
                </div>
              </div>
              <div className="status-cell empty">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>No memory</span><span>repo history absent</span>
                </div>
              </div>
            </div>

            <div className="grid-row" role="row">
              <div className="tool" role="rowheader">
                ai-git-hooks<small>read-only reviewer</small>
              </div>
              <div className="status-cell present">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>Review</span><span>diff scan</span>
                </div>
              </div>
              <div className="status-cell empty">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>Manual fix</span><span>no accept loop</span>
                </div>
              </div>
              <div className="status-cell empty">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>No gate</span><span>before push only</span>
                </div>
              </div>
              <div className="status-cell empty">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>No memory</span><span>single scan</span>
                </div>
              </div>
            </div>

            <div className="grid-row" role="row">
              <div className="tool" role="rowheader">
                no-mistakes<small>agentic fix loop</small>
              </div>
              <div className="status-cell empty">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>No visual diff</span><span>no line review</span>
                </div>
              </div>
              <div className="status-cell present">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>Fix</span><span>agent applies changes</span>
                </div>
              </div>
              <div className="status-cell present">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>Test-gate</span><span>re-tests before push</span>
                </div>
              </div>
              <div className="status-cell empty">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>No memory</span><span>run-by-run only</span>
                </div>
              </div>
            </div>

            <div className="grid-row" role="row">
              <div className="tool" role="rowheader">
                CI scanners<small>Snyk / pipeline checks</small>
              </div>
              <div className="status-cell empty">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>After push</span><span>not in CLI flow</span>
                </div>
              </div>
              <div className="status-cell empty">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>External fix</span><span>outside hook</span>
                </div>
              </div>
              <div className="status-cell present">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>Test-gate</span><span>blocks in CI</span>
                </div>
              </div>
              <div className="status-cell empty">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>No memory</span><span>repo recall absent</span>
                </div>
              </div>
            </div>

            <div className="grid-row" role="row">
              <div className="tool" role="rowheader">
                Git AutoReview<small>PR-time reviewer</small>
              </div>
              <div className="status-cell present">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>Review</span><span>post-push PR scan</span>
                </div>
              </div>
              <div className="status-cell empty">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>No fix</span><span>review only</span>
                </div>
              </div>
              <div className="status-cell empty">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>No gate</span><span>after review starts</span>
                </div>
              </div>
              <div className="status-cell empty">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>No memory</span><span>no repo timeline</span>
                </div>
              </div>
            </div>

            <div className="grid-row" role="row">
              <div className="tool" role="rowheader">
                SecurePush<small>pre-push workflow</small>
              </div>
              <div className="status-cell filled-green">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>Review</span><span>colored diff</span>
                </div>
              </div>
              <div className="status-cell filled-green">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>Fix</span><span>accept each change</span>
                </div>
              </div>
              <div className="status-cell filled-green">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>Test-gate</span><span>block on fail</span>
                </div>
              </div>
              <div className="status-cell filled-green">
                <span className="status-indicator" aria-hidden="true"></span>
                <div className="indicator-text">
                  <span>Memory</span><span>same repo over time</span>
                </div>
              </div>
            </div>
          </div>
          <p className="compare-note">
            Neutral indicators mark capabilities that exist elsewhere in the
            landscape. Green is reserved for the full pre-push flow SecurePush
            keeps in one place.
          </p>
        </div>
      </section>

      <section id="memory">
        <div className="section-head">
          <div className="eyebrow">history preview</div>
          <h2>Memory turns repeated mistakes into visible patterns.</h2>
          <p className="section-copy">
            The CLI catches the line in front of the push. The dashboard makes
            the pattern visible afterward: what was found, what the developer
            accepted, what got blocked, and what keeps happening in this repo.
          </p>
        </div>
        <div className="memory-section">
          <div className="memory-panel">
            <h3 className="memory-title">repo://securepush-demo/main</h3>
            <ul className="memory-log">
              <li>
                <span className="terminal-meta"
                  >2026-07-24 09:41 / apps/web/lib/auth.ts / finding:
                  hardcoded_secret</span
                >
                <span
                  ><span className="accepted-text">Fixed</span> / accepted
                  environment variable swap, tests passed, push continued.</span
                >
              </li>
              <li>
                <span className="terminal-meta"
                  >2026-07-22 18:07 / packages/cli/src/providers.ts / finding:
                  hallucinated_dependency</span
                >
                <span
                  ><span className="proposed-text">Proposed</span> / rejected import
                  rewrite, warning retained for follow-up.</span
                >
              </li>
              <li>
                <span className="terminal-meta"
                  >2026-07-20 13:12 / api/session.ts / finding:
                  insecure_auth_flow</span
                >
                <span
                  ><span className="removed-text">Blocked</span> / test gate failed
                  after fix, nothing reached GitHub.</span
                >
              </li>
            </ul>
            <Link className="link-card" href="/dashboard/securepush-demo"
              >Open the full history / insights page →</Link
            >
          </div>
          <aside className="history-snippet">
            <div className="eyebrow">judge hook</div>
            <h3>Near misses caught before GitHub</h3>
            <ul className="snippet-list">
              <li><strong>7 secrets</strong> removed before they shipped.</li>
              <li>
                <strong>3 hallucinated dependencies</strong> flagged this week.
              </li>
              <li>
                <strong>2 auth vulnerabilities</strong> blocked by the test
                gate.
              </li>
              <li><strong>0 incidents</strong> in the seeded demo repo.</li>
            </ul>
            <div className="command-line">
              Install once, then let every push prove itself.
            </div>
          </aside>
        </div>
      </section>

      
      <section id="pricing-preview" className="section">
        <div className="section-head" style={{ textAlign: 'center', margin: '0 auto 48px', alignItems: 'center', display: 'flex', flexDirection: 'column' }}>
          <h2>Pricing that makes sense</h2>
          <p className="lead">Choose how you want to run SecurePush.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', maxWidth: '1000px', margin: '0 auto' }}>
          <div className="recent-activity" style={{ padding: '32px' }}>
            <h3 style={{ fontSize: '20px', margin: 0 }}>Free</h3>
            <p style={{ color: 'var(--text-muted)', margin: '12px 0 24px' }}>Up to 3 repos</p>
            <div style={{ fontSize: '42px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.04em' }}>$0</div>
          </div>
          <div className="recent-activity" style={{ padding: '32px', borderColor: 'var(--text-primary)', borderStyle: 'solid', borderWidth: '1px' }}>
            <h3 style={{ fontSize: '20px', margin: 0 }}>Pro</h3>
            <p style={{ color: 'var(--text-muted)', margin: '12px 0 24px' }}>Unlimited repos</p>
            <div style={{ fontSize: '42px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.04em' }}>$15<span style={{ fontSize: '16px', color: 'var(--text-muted)', fontWeight: 400 }}>/mo</span></div>
          </div>
          <div className="recent-activity" style={{ padding: '32px' }}>
            <h3 style={{ fontSize: '20px', margin: 0 }}>BYO-key & Local</h3>
            <p style={{ color: 'var(--text-muted)', margin: '12px 0 24px' }}>Run it yourself</p>
            <div style={{ fontSize: '42px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.04em' }}>Free forever</div>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '48px' }}>
          <Link href="/pricing" className="button">View full pricing →</Link>
        </div>
      </section>

      <footer>
        <span>~/securepush $ accept a fix, then run the tests</span>
        <span>
          <Link href="/login">Sign in to link your CLI</Link>
        </span>
      </footer>
    </main>
    </>
  );
}
