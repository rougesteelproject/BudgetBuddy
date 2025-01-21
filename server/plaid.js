require('dotenv').config();
const { Configuration, PlaidEnvironments, PlaidApi } = require('plaid');

// Set up Plaid API client
const plaidConfig = new Configuration({
    basePath: PlaidEnvironments.sandbox, // or .development / .production for other environments
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
      },
    },
  });
  const plaidClient = new PlaidApi(plaidConfig);

module.exports = plaidClient;