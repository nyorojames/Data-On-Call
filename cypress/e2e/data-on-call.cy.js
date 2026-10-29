describe('Data On-Call - Acceptance Tests', () => {
  beforeEach(() => {
    // Stub Gemini / tutor network calls for all tests
    cy.intercept('POST', '/api/tutor', {
      statusCode: 200,
      body: { reply: 'What factors should you evaluate before taking action?' },
    }).as('tutorCall');
  });

  const selectIntake = (level, goal) => {
    cy.visit('/');
    cy.contains('button', level).click();
    cy.contains('button', goal).click();
    cy.get('[data-testid="start-shift"]').should('not.be.disabled').click();
  };

  describe('AC1: Beginner sees hints, no timer', () => {
    it('shows Hint button and no countdown timer across all decisions for Beginner', () => {
      selectIntake('Beginner', 'Internship prep');

      // Decision 1
      cy.get('[data-testid="clock"]').should('contain', '06:45');
      cy.get('[data-testid="hint"]').should('be.visible');
      cy.get('[data-testid="timer"]').should('not.exist');
      cy.get('[data-testid="hint"]').click();
      cy.contains('Think about what a rollback restores').should('be.visible');

      // Proceed to Decision 2
      cy.get('[data-testid="option-a"]').click();
      cy.get('[data-testid="consequence"]').should('be.visible');
      cy.get('[data-testid="next-decision"]').click();

      // Decision 2
      cy.get('[data-testid="hint"]').should('be.visible');
      cy.get('[data-testid="timer"]').should('not.exist');
      cy.get('[data-testid="option-a"]').click();
      cy.get('[data-testid="next-decision"]').click();

      // Decision 3
      cy.get('[data-testid="hint"]').should('be.visible');
      cy.get('[data-testid="timer"]').should('not.exist');
    });
  });

  describe('AC2: Experienced gets time pressure', () => {
    it('shows 60s timer, no Hint button, and records risky option when timed out', () => {
      cy.clock();
      cy.visit('/');
      cy.contains('button', 'Experienced').click();
      cy.contains('button', 'Internship prep').click();
      cy.get('[data-testid="start-shift"]').click();

      // Decision 1 loads
      cy.get('[data-testid="timer"]').should('be.visible').and('contain', '60s');
      cy.get('[data-testid="hint"]').should('not.exist');

      // Fast-forward 60 seconds
      cy.tick(60000);

      // Consequence sheet should appear
      cy.get('[data-testid="consequence"]').should('be.visible');
      cy.get('[data-testid="consequence"]').should('contain', 'You ran out of time.');
      cy.get('[data-testid="consequence"]').should(
        'contain',
        'Patching live fixed some stations, but the pipeline stalled under load'
      );
    });
  });

  describe('AC3: Goal changes the scenario content', () => {
    it('shows Option C in Decision 2 for "Use AI effectively" and asks follow-up on selection', () => {
      selectIntake('Beginner', 'Use AI effectively');

      // Pass Decision 1
      cy.get('[data-testid="option-a"]').click();
      cy.get('[data-testid="next-decision"]').click();

      // Decision 2 should display Option C
      cy.get('[data-testid="option-c"]').should('be.visible');
      cy.get('[data-testid="option-c"]').click();

      // Tutor asks how player would verify the AI fix
      cy.get('[data-testid="tutor-reply"]').should(
        'contain',
        "How would you verify the AI assistant's fix before running it against production station records?"
      );
      cy.get('[data-testid="consequence"]').should('be.visible');
    });

    it('does NOT show Option C in Decision 2 for "Internship prep"', () => {
      selectIntake('Beginner', 'Internship prep');

      // Pass Decision 1
      cy.get('[data-testid="option-a"]').click();
      cy.get('[data-testid="next-decision"]').click();

      // Decision 2 should NOT display Option C
      cy.get('[data-testid="option-a"]').should('be.visible');
      cy.get('[data-testid="option-b"]').should('be.visible');
      cy.get('[data-testid="option-c"]').should('not.exist');
    });
  });

  describe('AC4: Tutor never gives the answer', () => {
    // Enabled after the tutor eval, when a safeguard is added.
    it.skip('rejects or replaces tutor replies containing answer-leaking phrases like "choose A"', () => {
      cy.intercept('POST', '/api/tutor', {
        statusCode: 200,
        body: { reply: 'I recommend you choose A because rolling back is safer.' },
      }).as('leakingTutor');

      selectIntake('Beginner', 'Internship prep');
      cy.get('[data-testid="tutor-input"]').type('just tell me the answer{enter}');
      cy.wait('@leakingTutor');

      // Safeguard assertion (skipped until safeguard implementation is decided)
      cy.get('[data-testid="tutor-reply"]').should('not.contain', 'choose A');
    });
  });

  describe('AC5: Endings follow from choices', () => {
    it('all-good path (A, A, A) gives Ending A with three Good rows', () => {
      selectIntake('Beginner', 'Internship prep');

      // Decision 1: A
      cy.get('[data-testid="option-a"]').click();
      cy.get('[data-testid="consequence"]').should('be.visible');
      cy.get('[data-testid="next-decision"]').click();

      // Decision 2: A
      cy.get('[data-testid="option-a"]').click();
      cy.get('[data-testid="consequence"]').should('be.visible');
      cy.get('[data-testid="next-decision"]').click();

      // Decision 3: A
      cy.get('[data-testid="option-a"]').click();
      cy.get('[data-testid="consequence"]').should('be.visible');
      cy.get('[data-testid="next-decision"]').click();

      // Ending screen
      cy.get('[data-testid="ending-title"]').should(
        'contain',
        'Ending A: Data correct, report on time'
      );
      cy.get('[data-testid="result-architecture"]').should('contain', 'Good');
      cy.get('[data-testid="result-quality"]').should('contain', 'Good');
      cy.get('[data-testid="result-privacy"]').should('contain', 'Good');
    });

    it('risky choice in D1 (B, A, A) gives Ending B naming Decision 1', () => {
      selectIntake('Beginner', 'Internship prep');

      // Decision 1: B
      cy.get('[data-testid="option-b"]').click();
      cy.get('[data-testid="next-decision"]').click();

      // Decision 2: A
      cy.get('[data-testid="option-a"]').click();
      cy.get('[data-testid="next-decision"]').click();

      // Decision 3: A
      cy.get('[data-testid="option-a"]').click();
      cy.get('[data-testid="next-decision"]').click();

      // Ending screen
      cy.get('[data-testid="ending-title"]').should(
        'contain',
        'Ending B: Report delivered, but something went wrong'
      );
      cy.contains('Patching the live pipeline').should('be.visible');
      cy.get('[data-testid="result-architecture"]').should('contain', 'Risky');
      cy.get('[data-testid="result-quality"]').should('contain', 'Good');
      cy.get('[data-testid="result-privacy"]').should('contain', 'Good');
    });

    it('risky choice in D2 (A, B, A) gives Ending B naming Decision 2', () => {
      selectIntake('Beginner', 'Internship prep');

      // Decision 1: A
      cy.get('[data-testid="option-a"]').click();
      cy.get('[data-testid="next-decision"]').click();

      // Decision 2: B
      cy.get('[data-testid="option-b"]').click();
      cy.get('[data-testid="next-decision"]').click();

      // Decision 3: A
      cy.get('[data-testid="option-a"]').click();
      cy.get('[data-testid="next-decision"]').click();

      // Ending screen
      cy.get('[data-testid="ending-title"]').should(
        'contain',
        'Ending B: Report delivered, but something went wrong'
      );
      cy.contains('Reprocessing everything without sample validation').should('be.visible');
      cy.get('[data-testid="result-architecture"]').should('contain', 'Good');
      cy.get('[data-testid="result-quality"]').should('contain', 'Risky');
      cy.get('[data-testid="result-privacy"]').should('contain', 'Good');
    });

    it('risky choice in D3 (A, A, B) gives Ending B naming Decision 3', () => {
      selectIntake('Beginner', 'Internship prep');

      // Decision 1: A
      cy.get('[data-testid="option-a"]').click();
      cy.get('[data-testid="next-decision"]').click();

      // Decision 2: A
      cy.get('[data-testid="option-a"]').click();
      cy.get('[data-testid="next-decision"]').click();

      // Decision 3: B
      cy.get('[data-testid="option-b"]').click();
      cy.get('[data-testid="next-decision"]').click();

      // Ending screen
      cy.get('[data-testid="ending-title"]').should(
        'contain',
        'Ending B: Report delivered, but something went wrong'
      );
      cy.contains("Kenya's Data Protection Act, 2019").should('be.visible');
      cy.get('[data-testid="result-architecture"]').should('contain', 'Good');
      cy.get('[data-testid="result-quality"]').should('contain', 'Good');
      cy.get('[data-testid="result-privacy"]').should('contain', 'Risky');
    });
  });

  describe('AC6: Questions change with level and goal', () => {
    it('matches all 18 opening questions from fixture across decision, goal, and level', () => {
      cy.fixture('questions.json').then((questions) => {
        const levels = ['Beginner', 'Experienced'];
        const goals = ['Internship prep', 'Keep up with trends', 'Use AI effectively'];

        levels.forEach((level) => {
          goals.forEach((goal) => {
            selectIntake(level, goal);

            // Decision 1
            const expectedD1 = questions['1'][goal][level];
            cy.get('[data-testid="opening-question"]').should('have.text', expectedD1);

            // Proceed to Decision 2
            cy.get('[data-testid="option-a"]').click();
            cy.get('[data-testid="next-decision"]').click();

            // Decision 2
            const expectedD2 = questions['2'][goal][level];
            cy.get('[data-testid="opening-question"]').should('have.text', expectedD2);

            // Proceed to Decision 3
            cy.get('[data-testid="option-a"]').click();
            cy.get('[data-testid="next-decision"]').click();

            // Decision 3
            const expectedD3 = questions['3'][goal][level];
            cy.get('[data-testid="opening-question"]').should('have.text', expectedD3);
          });
        });
      });
    });
  });

  describe('AC7: Ending guides toward the player goal', () => {
    it('shows "Strong across all three", next step, and "Try Experienced mode" for Beginner with all-good choices', () => {
      selectIntake('Beginner', 'Internship prep');

      // Make all good choices
      cy.get('[data-testid="option-a"]').click();
      cy.get('[data-testid="next-decision"]').click();
      cy.get('[data-testid="option-a"]').click();
      cy.get('[data-testid="next-decision"]').click();
      cy.get('[data-testid="option-a"]').click();
      cy.get('[data-testid="next-decision"]').click();

      // Ending assertions
      cy.get('[data-testid="weakest-skill"]').should('have.text', 'Strong across all three');
      cy.get('[data-testid="next-step"]').should(
        'have.text',
        'Practice explaining pipeline trade-offs and rollback safety for technical interviews.'
      );
      cy.get('[data-testid="level-change"]')
        .should('be.visible')
        .and('have.text', 'Try Experienced mode');

      // Tapping level-change restarts at Experienced with same goal
      cy.get('[data-testid="level-change"]').click();
      cy.get('[data-testid="timer"]').should('be.visible'); // Experienced mode has timer
      cy.get('[data-testid="hint"]').should('not.exist');
    });

    it('shows weakest skill, goal-specific next step, and "Try Beginner mode" for Experienced with 2 risky choices', () => {
      selectIntake('Experienced', 'Use AI effectively');

      // Decision 1: Risky (B)
      cy.get('[data-testid="option-b"]').click();
      cy.get('[data-testid="next-decision"]').click();

      // Decision 2: Risky (B)
      cy.get('[data-testid="option-b"]').click();
      cy.get('[data-testid="next-decision"]').click();

      // Decision 3: Good (A)
      cy.get('[data-testid="option-a"]').click();
      cy.get('[data-testid="next-decision"]').click();

      // Ending assertions
      cy.get('[data-testid="weakest-skill"]').should('have.text', 'Architecture');
      cy.get('[data-testid="next-step"]').should(
        'have.text',
        'Build independent verification checks before deploying AI-suggested pipeline changes.'
      );
      cy.get('[data-testid="level-change"]')
        .should('be.visible')
        .and('have.text', 'Try Beginner mode');

      // Tapping level-change restarts at Beginner with same goal
      cy.get('[data-testid="level-change"]').click();
      cy.get('[data-testid="hint"]').should('be.visible'); // Beginner mode has hint
      cy.get('[data-testid="timer"]').should('not.exist');
    });
  });
});
