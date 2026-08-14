export const RISK_CONFIG = {
  multipleAccounts: {
    enabled: true,
    distinctUsersThreshold: 4,
    windowHours: 24,
    riskScore: 75,
  },
  payoutReconciliation: {
    enabled: true,
    riskScore: 95,
  },
  highRiskPayout: {
    // Regra desativada por padrão até a definição de thresholds por moeda/país
    enabled: false,
    riskScore: 85,
    thresholdsByCurrency: {} as Record<string, number>,
  },
};
