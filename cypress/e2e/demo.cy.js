describe('Data On-Call - Product Demo Walkthrough', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/tutor', {
      statusCode: 200,
      body: {
        reply:
          'What indicators would tell you whether the telemetry drop is caused by the deploy or an upstream outage?',
      },
    }).as('tutorMock');
  });

  it('runs a smooth 60-second end-to-end product demonstration', () => {
    // -------------------------------------------------------------------------
    // Phase 1: Intake & Beginner Mode (Hint button visible)
    // -------------------------------------------------------------------------
    cy.visit('/');
    cy.wait(2000);

    // Select Beginner level
    cy.contains('button', 'Beginner').click();
    cy.wait(1200);

    // Select Internship prep goal
    cy.contains('button', 'Internship prep').click();
    cy.wait(1200);

    // Start shift
    cy.get('[data-testid="start-shift"]').click();
    cy.wait(2000);

    // Decision 1: Notice status bar, scenario, and Hint button
    cy.get('[data-testid="hint"]').should('be.visible').click();
    cy.wait(3000);

    // Chat with the Socratic AI tutor
    cy.get('[data-testid="tutor-input"]').type('Should I just patch the live pipeline?');
    cy.wait(1000);
    cy.contains('button', 'Ask').click();
    cy.wait(2500);

    // Select Option A and observe consequence
    cy.get('[data-testid="option-a"]').click();
    cy.wait(2500);

    // -------------------------------------------------------------------------
    // Phase 2: Switch to Experienced Mode & "Use AI effectively"
    // -------------------------------------------------------------------------
    cy.visit('/');
    cy.wait(1500);

    // Select Experienced level
    cy.contains('button', 'Experienced').click();
    cy.wait(1200);

    // Select Use AI effectively goal
    cy.contains('button', 'Use AI effectively').click();
    cy.wait(1200);

    // Start shift
    cy.get('[data-testid="start-shift"]').click();
    cy.wait(2000);

    // Decision 1: Notice 60s countdown timer and absence of hint button
    cy.get('[data-testid="timer"]').should('be.visible');
    cy.wait(2500);

    // Make good choice on D1
    cy.get('[data-testid="option-a"]').click();
    cy.wait(1500);
    cy.get('[data-testid="next-decision"]').click();
    cy.wait(2000);

    // Decision 2: Option C (AI-suggested fix) is uniquely rendered
    cy.get('[data-testid="option-c"]').should('be.visible');
    cy.wait(2500);

    // Select Option C
    cy.get('[data-testid="option-c"]').click();
    cy.wait(2500);

    // Advance to Decision 3
    cy.get('[data-testid="next-decision"]').click();
    cy.wait(2000);

    // Decision 3: Privacy
    cy.get('[data-testid="option-a"]').click();
    cy.wait(2000);

    // View Results
    cy.get('[data-testid="next-decision"]').click();
    cy.wait(2000);

    // -------------------------------------------------------------------------
    // Phase 3: Ending Screen (Growth, Weakest skill & Next step)
    // -------------------------------------------------------------------------
    cy.get('[data-testid="ending-title"]').should('be.visible');
    cy.get('[data-testid="weakest-skill"]').should('be.visible');
    cy.get('[data-testid="next-step"]').should('be.visible');
    cy.wait(4000);
  });
});
