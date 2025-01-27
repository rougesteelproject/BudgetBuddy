import React, { useEffect, useState } from 'react';
import { PlaidLink } from 'react-plaid-link';

const PlaidPage = () => {
  const [linkToken, setLinkToken] = useState(null);

  useEffect(() => {
    // Fetch the link_token from your server
    fetch('/api/create_link_token')
      .then(response => response.json())
      .then(data => setLinkToken(data.link_token));
  }, []);

  const handleOnSuccess = (public_token, metadata) => {
    if (!public_token) {
      console.error('Public token is missing');
      return;
    }

    // Send the public_token to your server
    fetch('/api/exchange_public_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ public_token }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        console.error('Error exchanging public token:', data.error);
      } else {
        console.log('Successfully exchanged public token:', data);
      }
    })
    .catch(error => console.error('Error:', error));
  };

  return (
    <div>
      <h1>Plaid Integration</h1>
      {linkToken && (
        <PlaidLink
          token={linkToken}
          onSuccess={handleOnSuccess}
        >
          Connect to Plaid
        </PlaidLink>
      )}
    </div>
  );
};

export default PlaidPage;