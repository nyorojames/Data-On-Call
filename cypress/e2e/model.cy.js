describe('In-Browser Model Inference & Adaptive Tutoring (AC9 & AC10)', () => {
  beforeEach(() => {
    // Stub tutor API calls to avoid external dependency
    cy.intercept('POST', '/api/tutor', {
      statusCode: 200,
      body: { reply: 'What factors should you evaluate before taking action?' },
    }).as('tutorCall');
  });

  describe('(a) AC10 Parity Benchmark', () => {
    it('achieves parity within 1e-4 for all 5 benchmark vectors in tests/parity.json', () => {
      cy.readFile('tests/parity.json').then((vectors) => {
        vectors.forEach((vec) => {
          const xParam = vec.features.join(',');
          cy.visit(`/?parity=1&x=${xParam}`);
          cy.get('[data-cy="p"]', { timeout: 15000 })
            .should('be.visible')
            .invoke('attr', 'data-value')
            .then((attrVal) => {
              const actual = parseFloat(attrVal);
              const expected = vec.expected_probability;
              const diff = Math.abs(actual - expected);
              expect(diff).to.be.lessThan(
                1e-4,
                `Vector [${xParam}]: expected ${expected}, got ${actual} (diff: ${diff})`
              );
            });
        });
      });
    });
  });

  describe('(b) Beginner Scene 1: Low Risk (p ≈ 0.32)', () => {
    it('exhibits pure v1 behavior without proactive question', () => {
      cy.visit('/');
      cy.contains('h1', 'Start your shift').should('be.visible');
      cy.contains('button', 'Beginner').click();
      cy.contains('button', 'Internship prep').click();
      cy.get('[data-testid="start-shift"]').click();

      // Scene 1 loads
      cy.get('[data-cy="p"]', { timeout: 15000 }).should('be.visible');
      cy.get('[data-cy="p"]')
        .invoke('attr', 'data-value')
        .then((val) => {
          const p = parseFloat(val);
          expect(p).to.be.closeTo(0.319, 0.02);
          expect(p).to.be.lessThan(0.5);
        });

      // Pure v1 behavior: no proactive question, timer absent, hint button present
      cy.get('[data-testid="proactive-question"]').should('not.exist');
      cy.get('[data-testid="timer"]').should('not.exist');
      cy.get('[data-testid="hint"]').should('be.visible');
      cy.get('[data-testid="opening-question"]').should('be.visible');
    });
  });

  describe('(c) Experienced Scene 1: Moderate Risk (p ≈ 0.56)', () => {
    it('shows proactive question while countdown timer continues ticking down', () => {
      cy.visit('/');
      cy.contains('h1', 'Start your shift').should('be.visible');
      cy.contains('button', 'Experienced').click();
      cy.contains('button', 'Internship prep').click();
      cy.get('[data-testid="start-shift"]').click();

      // Scene 1 loads
      cy.get('[data-cy="p"]', { timeout: 15000 }).should('be.visible');
      cy.get('[data-cy="p"]')
        .invoke('attr', 'data-value')
        .then((val) => {
          const p = parseFloat(val);
          expect(p).to.be.closeTo(0.564, 0.02);
          expect(p).to.be.at.least(0.5);
          expect(p).to.be.lessThan(0.75);
        });

      // Proactive question is visible
      cy.get('[data-testid="proactive-question"]').should('be.visible');
      cy.get('[data-testid="opening-question"]').should('be.visible');

      // Countdown timer is visible and actively runs (ticks down)
      cy.get('[data-testid="timer"]').should('be.visible');
      cy.get('[data-testid="timer"]')
        .invoke('text')
        .then((initialText) => {
          const initialSec = parseInt(initialText.replace('s', ''), 10);
          expect(initialSec).to.be.at.most(60);
          cy.get('[data-testid="timer"]', { timeout: 4000 }).should(($el) => {
            const currentSec = parseInt($el.text().replace('s', ''), 10);
            expect(currentSec).to.be.lessThan(initialSec);
          });
        });
    });
  });

  describe('(d) Experienced Scene 2 after Risky Choice: High Risk (p ≈ 0.77)', () => {
    it('shows proactive question and PAUSES countdown timer', () => {
      cy.clock();
      cy.visit('/');
      cy.contains('h1', 'Start your shift').should('be.visible');
      cy.contains('button', 'Experienced').click();
      cy.contains('button', 'Internship prep').click();
      cy.get('[data-testid="start-shift"]').click();

      // Ensure Scene 1 is mounted
      cy.get('[data-testid="option-b"]').should('be.visible');

      // Fast-forward 28.4s decision time in Scene 1
      cy.tick(28400);

      // Choose risky option B in Scene 1 and advance to Scene 2
      cy.get('[data-testid="option-b"]').click();
      cy.get('[data-testid="consequence"]').should('be.visible');
      cy.get('[data-testid="next-decision"]').click();

      // Scene 2 loads with high risk (features: [1, 0, 2, 0, 1, 0, 28.4]) -> p ≈ 0.77 >= 0.75
      cy.get('[data-cy="p"]', { timeout: 15000 }).should('be.visible');
      cy.get('[data-cy="p"]')
        .invoke('attr', 'data-value')
        .then((val) => {
          const p = parseFloat(val);
          expect(p).to.be.closeTo(0.769, 0.03);
          expect(p).to.be.at.least(0.75);
        });

      // Proactive question is visible
      cy.get('[data-testid="proactive-question"]').should('be.visible');

      // Timer is visible and PAUSED (remains 60s without ticking down)
      cy.get('[data-testid="timer"]').should('be.visible').and('contain', '60s');
      cy.tick(5000);
      cy.get('[data-testid="timer"]').should('contain', '60s');

      // Restore clock for subsequent tests
      cy.clock().then((clock) => {
        clock.restore();
      });
    });
  });

  describe('(e) Model Load Failure Graceful Fallback', () => {
    it('falls back to pure v1 behavior without error banners when model fails to load', () => {
      // Intercept model artifacts to simulate network or load failure
      cy.intercept('GET', '**/model/**', { statusCode: 500 }).as('failedModelLoad');

      cy.visit('/');
      cy.contains('h1', 'Start your shift').should('be.visible');
      cy.contains('button', 'Experienced').click();
      cy.contains('button', 'Internship prep').click();
      cy.get('[data-testid="start-shift"]').click();

      // Scene 1 loads normally in v1 behavior
      cy.get('[data-testid="scenario"]').should('be.visible');
      cy.get('[data-testid="opening-question"]').should('be.visible');

      // Adaptive UI is absent, no status line with data-cy="p", no proactive question
      cy.get('[data-cy="p"]').should('not.exist');
      cy.get('[data-testid="proactive-question"]').should('not.exist');

      // Timer runs normally
      cy.get('[data-testid="timer"]').should('be.visible').and('contain', '60s');
      cy.get('[data-testid="timer"]', { timeout: 4000 }).should('not.contain', '60s');

      // No error message surfaced to the player
      cy.contains(/error|failed/i).should('not.exist');
    });
  });

  describe('(f) Static Deployment Resilience (No Backend / 404 on all APIs)', () => {
    it('runs smoothly with 404 on tutor, log, and log status endpoints', () => {
      cy.intercept('GET', '**/api/log/status', { statusCode: 404, body: 'Not Found' }).as('status404');
      cy.intercept('POST', '**/api/log', { statusCode: 404, body: 'Not Found' }).as('log404');
      cy.intercept('POST', '**/api/tutor', { statusCode: 404, body: 'Not Found' }).as('tutor404');

      cy.visit('/');
      cy.contains('h1', 'Start your shift').should('be.visible');

      // No data-collection badge appears
      cy.get('[data-testid="collection-indicator"]').should('not.exist');

      cy.contains('button', 'Beginner').click();
      cy.contains('button', 'Internship prep').click();
      cy.get('[data-testid="start-shift"]').click();

      // Scene 1: shows pre-written tutor question
      cy.get('[data-testid="opening-question"]')
        .should('be.visible')
        .and('contain', 'An interviewer asks: what is a data pipeline');
      cy.get('[data-testid="option-a"]').click();
      cy.get('[data-testid="consequence"]').should('be.visible');
      cy.get('[data-testid="next-decision"]').click();

      // Scene 2: plays through
      cy.get('[data-testid="opening-question"]')
        .should('be.visible')
        .and('contain', 'An interviewer asks: what are three simple checks');
      cy.get('[data-testid="option-a"]').click();
      cy.get('[data-testid="consequence"]').should('be.visible');
      cy.get('[data-testid="next-decision"]').click();

      // Scene 3: plays through
      cy.get('[data-testid="opening-question"]')
        .should('be.visible')
        .and('contain', 'An interviewer asks: what is personal data');
      cy.get('[data-testid="option-a"]').click();
      cy.get('[data-testid="consequence"]').should('be.visible');
      cy.get('[data-testid="next-decision"]').click();

      // Completes to ending screen cleanly
      cy.get('[data-testid="ending-title"]')
        .should('be.visible')
        .and('contain', 'Ending A: Data correct, report on time');
    });
  });
});
