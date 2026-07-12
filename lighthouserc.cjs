module.exports = {
  ci: {
    collect: {
      staticDistDir: "./apps/web/dist",
      url: ["http://localhost/"],
      numberOfRuns: 2,
      settings: {
        chromeFlags: "--no-sandbox --headless=new"
      }
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.85 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["error", { minScore: 0.95 }],
        "categories:seo": ["warn", { minScore: 0.9 }],
        "interactive": ["error", { maxNumericValue: 3500 }],
        "service-worker": "off",
        "installable-manifest": "off",
        "total-byte-weight": ["warn", { maxNumericValue: 900000 }]
      }
    },
    upload: { target: "temporary-public-storage" }
  }
};
