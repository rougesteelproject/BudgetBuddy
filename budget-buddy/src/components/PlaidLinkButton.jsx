import React, { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';

const PlaidLinkButton = ({ onSuccess }) => {
  const [linkToken, setLinkToken] = useState(null);

  useEffect(() => {
    // Fetch the link token from the backend
    const fetchLinkToken = async () => {
      const response = await fetch('/api/exchange-token');
      const data = await response.json();
      setLinkToken(data.link_token);
    };

    fetchLinkToken();
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken, metadata) => {
      onSuccess(publicToken, metadata);
    },
    onExit: (error, metadata) => {
      console.error('Plaid Link exited:', error, metadata);
    },
  });

  return (
    <button onClick={() => open()} disabled={!ready}>
      Link Your Bank Account
    </button>
  );
};

export default PlaidLinkButton;
