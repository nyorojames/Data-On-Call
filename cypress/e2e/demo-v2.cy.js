describe('Data On-Call v2 Demo Walkthrough', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/tutor', {
      statusCode: 200,
      body: { reply: 'What factors should you evaluate before taking action on production data?' },
    }).as('tutorCall');
  });

  it('demonstrates Player A (safe -> low risk, timer runs) vs Player B (risky -> high risk, proactive coach, paused timer) and parity page', () => {
    // -------------------------------------------------------------------------
    // PART 1: Player A - Experienced + Use AI effectively (Safe Path in Scene 1)
    // -------------------------------------------------------------------------
    cy.visit('/');
    cy.wait(1500);

    // Intake screen selection
    cy.contains('button', 'Experienced').click();
    cy.wait(800);
    cy.contains('button', 'Use AI effectively').click();
    cy.wait(1000);
    cy.get('[data-testid="start-shift"]').click();
    cy.wait(1500);

    // Scene 1: Player A reads scenario and selects safe Option A
    cy.get('[data-testid="scenario"]').should('be.visible');
    cy.wait(2000);
    cy.get('[data-testid="option-a"]').click();
    cy.wait(1500);
    cy.get('[data-testid="next-decision"]').click();

    // Scene 2: Low risk (p ≈ 0.49 < 0.50)
    // Adaptive tutor status line is visible
    cy.get('[data-cy="p"]', { timeout: 15000 }).should('be.visible');
    cy.wait(1500);

    // No proactive question, timer actively runs
    cy.get('[data-testid="proactive-question"]').should('not.exist');
    cy.get('[data-testid="timer"]').should('be.visible');
    cy.wait(3000);

    // -------------------------------------------------------------------------
    // PART 2: Player B - Experienced + Use AI effectively (Risky Path in Scene 1)
    // -------------------------------------------------------------------------
    // Start fresh playthrough
    cy.visit('/');
    cy.wait(1500);

    cy.contains('button', 'Experienced').click();
    cy.wait(800);
    cy.contains('button', 'Use AI effectively').click();
    cy.wait(1000);
    cy.get('[data-testid="start-shift"]').click();
    cy.wait(1500);

    // Scene 1: Player B hesitates (simulate 25s decision time) and chooses Option B
    cy.clock();
    cy.tick(25000);
    cy.get('[data-testid="option-b"]').click();
    cy.get('[data-testid="consequence"]').should('be.visible');
    cy.wait(1500);
    cy.get('[data-testid="next-decision"]').click();

    // Restore clock for normal async animations and WASM observation
    cy.clock().then((clock) => {
      clock.restore();
    });

    // Scene 2: High risk (p ≈ 0.77 >= 0.75)
    cy.get('[data-cy="p"]', { timeout: 15000 }).should('be.visible');
    cy.wait(1500);

    // Proactive question appears
    cy.get('[data-testid="proactive-question"]').should('be.visible');
    cy.wait(2000);

    // Timer is visibly paused at 60s
    cy.get('[data-testid="timer"]').should('be.visible').and('contain', '60s');
    cy.wait(3500);

    // -------------------------------------------------------------------------
    // PART 3: Parity Page Route (AC10 Automated Parity Verification)
    // -------------------------------------------------------------------------
    cy.visit('/?parity=1&x=1,2,2,0,1,0,25.0');
    cy.get('[data-cy="p"]', { timeout: 15000 }).should('be.visible');
    cy.wait(3500);
  });
});
