describe('Data Logging & Telemetry', () => {
  it('reports collection mode as OFF by default outside npm run collect', () => {
    // 1. Verify GET /api/log/status reports collection_mode: false
    cy.request('GET', '/api/log/status').then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.collection_mode).to.eq(false);
    });

    // 2. Verify POST /api/log returns 204 with X-Data-Collection: false outside collection mode
    const dummyPayload = {
      oturum: '0123456789abcdef0123456789abcdef',
      sahne_no: 1,
      seviye: 0,
      hedef: 0,
      onceki_ipucu_sayisi: 0,
      onceki_riskli_sayisi: 0,
      onceki_timeout_sayisi: 0,
      onceki_karar_suresi_sn: 0,
      ipucu_bu_sahne: 0,
      karar_suresi_sn: 10,
      secim_riskli: 0,
      kaynak: 'gercek',
    };

    cy.request({
      method: 'POST',
      url: '/api/log',
      body: dummyPayload,
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(204);
      expect(res.headers['x-data-collection']).to.eq('false');
    });

    // 3. Verify collection indicator is NOT rendered in normal mode
    cy.visit('/');
    cy.get('[data-testid="collection-indicator"]').should('not.exist');
  });

  it('renders "Data collection ON" indicator when collection mode is active', () => {
    cy.intercept('GET', '/api/log/status', {
      statusCode: 200,
      body: { collection_mode: true },
    }).as('statusOn');

    cy.visit('/');
    cy.wait('@statusOn');
    cy.get('[data-testid="collection-indicator"]')
      .should('be.visible')
      .and('contain', 'Data collection ON');
  });

  it('plays a full run, logging 3 rows with expected values including a timeout', () => {
    cy.clock();

    // Specific intercept for this test to inspect payload values
    cy.intercept('POST', '/api/log', {
      statusCode: 204,
      headers: { 'x-data-collection': 'false' },
    }).as('logRecord');

    cy.visit('/');
    cy.contains('h1', 'Start your shift').should('be.visible');
    cy.contains('button', 'Experienced').click();
    cy.contains('button', 'Use AI effectively').click();
    cy.get('[data-testid="start-shift"]').click();

    // Decision 1: Trigger timeout by advancing clock 60s
    cy.get('[data-testid="timer"]').should('be.visible').and('contain', '60s');
    cy.tick(60000);

    cy.wait('@logRecord').then((interception) => {
      const body = interception.request.body;
      expect(body.sahne_no).to.eq(1);
      expect(body.seviye).to.eq(1); // Experienced
      expect(body.hedef).to.eq(2); // Use AI effectively
      expect(body.onceki_ipucu_sayisi).to.eq(0);
      expect(body.onceki_riskli_sayisi).to.eq(0);
      expect(body.onceki_timeout_sayisi).to.eq(0);
      expect(body.onceki_karar_suresi_sn).to.eq(0);
      expect(body.secim_riskli).to.eq(1); // Timeout is risky
      expect(body.kaynak).to.eq('gercek');
      expect(body.oturum).to.match(/^[a-f0-9]{32}$/);
    });

    cy.get('[data-testid="consequence"]').should('be.visible');
    cy.get('[data-testid="next-decision"]').click();

    // Decision 2: Choose Good option (A)
    cy.get('[data-testid="option-a"]').click();

    cy.wait('@logRecord').then((interception) => {
      const body = interception.request.body;
      expect(body.sahne_no).to.eq(2);
      expect(body.seviye).to.eq(1);
      expect(body.hedef).to.eq(2);
      expect(body.onceki_riskli_sayisi).to.eq(1); // 1 prior risky choice (timeout in D1)
      expect(body.onceki_timeout_sayisi).to.eq(1); // 1 prior timeout in D1
      expect(body.secim_riskli).to.eq(0); // Option A is good
      expect(body.kaynak).to.eq('gercek');
    });

    cy.get('[data-testid="consequence"]').should('be.visible');
    cy.get('[data-testid="next-decision"]').click();

    // Decision 3: Choose Risky option (B)
    cy.get('[data-testid="option-b"]').click();

    cy.wait('@logRecord').then((interception) => {
      const body = interception.request.body;
      expect(body.sahne_no).to.eq(3);
      expect(body.seviye).to.eq(1);
      expect(body.hedef).to.eq(2);
      expect(body.onceki_riskli_sayisi).to.eq(1); // D1 was risky, D2 was good
      expect(body.onceki_timeout_sayisi).to.eq(1);
      expect(body.secim_riskli).to.eq(1); // Option B is risky
      expect(body.kaynak).to.eq('gercek');
    });

    cy.get('[data-testid="consequence"]').should('be.visible');
    cy.get('[data-testid="next-decision"]').click();

    // Ending screen: verify fallback download button is visible
    cy.get('[data-testid="ending-title"]').should('be.visible');
    cy.get('[data-testid="download-session"]')
      .should('be.visible')
      .and('contain', 'Download my session data (CSV)');
  });
});
