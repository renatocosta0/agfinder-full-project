module.exports = {
  payment: {
    provider: process.env.PAYMENT_PROVIDER || 'fake-payment',
    defaultCurrency: process.env.PAYMENT_DEFAULT_CURRENCY || 'AOA',
    fakeExpirationMinutes: Number.isFinite(parseInt(process.env.FAKE_PAYMENT_EXPIRATION_MINUTES, 10))
      ? parseInt(process.env.FAKE_PAYMENT_EXPIRATION_MINUTES, 10)
      : 60,
  },
  proxyPay: {
    apiKey: process.env.PROXYPAY_API_KEY || '',
    baseUrl: process.env.PROXYPAY_BASE_URL || '',
    entity: process.env.PROXYPAY_ENTITY || '',
    expirationSeconds: Number.isFinite(parseInt(process.env.PROXYPAY_EXPIRATION_SECONDS, 10))
      ? parseInt(process.env.PROXYPAY_EXPIRATION_SECONDS, 10)
      : 3600,
  },
};
