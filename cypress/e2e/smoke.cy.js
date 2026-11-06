describe('Production Artifact Smoke Test (Hugging Face Model & Plain Static Server)', () => {
  it('loads the model from Hugging Face and matches all 5 parity vectors (< 1e-4)', () => {
    cy.readFile('tests/parity.json').then((vectors) => {
      const results = [];

      vectors.forEach((vec, idx) => {
        const xParam = vec.features.join(',');
        cy.visit(`/?parity=1&x=${xParam}`);
        cy.get('[data-cy="p"]', { timeout: 20000 })
          .should('be.visible')
          .invoke('attr', 'data-value')
          .then((attrVal) => {
            const actual = parseFloat(attrVal);
            const expected = vec.expected_probability;
            const diff = Math.abs(actual - expected);

            results.push({
              index: idx + 1,
              description: vec.description,
              features: `[${xParam}]`,
              expected: expected.toFixed(6),
              actual: actual.toFixed(6),
              diff: diff.toExponential(2),
              match: diff < 1e-4,
            });

            expect(diff).to.be.lessThan(
              1e-4,
              `Vector ${idx + 1} [${xParam}]: expected ${expected}, got ${actual} (diff: ${diff})`
            );
          });
      });

      cy.then(() => {
        console.table(results);
      });
    });
  });
});
