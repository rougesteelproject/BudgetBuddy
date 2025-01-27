import React, { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';

const UpdatePlaidLinkButton = ({ accessToken }) => {
  const [linkToken, setLinkToken] = useState(null);

  useEffect(() => {
    const fetchUpdateLinkToken = async () => {
      const response = await fetch('/plaid-link-token-update');
      const data = await response.json();
      setLinkToken(data.link_token);
    };

    fetchUpdateLinkToken();
  }, [accessToken]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken, metadata) => {
      console.log('Plaid Link updated:', metadata);
    },
    onExit: (error, metadata) => {
      console.error('Plaid Link update exited:', error, metadata);
    },
  });

  return (
    <button onClick={() => open()} disabled={!ready}>
      Update Bank Account Link
    </button>
  );
};

export default UpdatePlaidLinkButton;
