import { usePlaidLink } from 'react-plaid-link';

function PlaidLinkComponent({ token, onSuccess }) {
  const { open, ready } = usePlaidLink({
    token,
    onSuccess: (public_token, metadata) => {
      // Send public_token to backend for exchange
      onSuccess(public_token);
    },
  });

  return <button onClick={() => open()} disabled={!ready}>Connect Bank</button>;
}
