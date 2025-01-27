import React from 'react';

const RemoveAccessTokenButton = ({ accessToken }) => {
  const handleRemove = async () => {
    try {
      const response = await fetch('/api/remove-access-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      });

      const data = await response.json();
      if (data.success) {
        alert('Access token removed successfully!');
      } else {
        console.error('Failed to remove access token:', data.error);
      }
    } catch (error) {
      console.error('Error removing access token:', error);
    }
  };

  return <button onClick={handleRemove}>Remove Access Token</button>;
};

export default RemoveAccessTokenButton;
