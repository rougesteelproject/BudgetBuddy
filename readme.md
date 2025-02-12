To run server:
- cd into 'server'
- run the following command: `node server.js`
- currently runs on localhost:3001

You'll need a .env file in the 'server' folder with: 
- "PLAID_CLIENT_ID"
- "PLAID_SECRET"
- "PLAID_ENV=sandbox"
- a placeholder "USER_ID"
- "CALLBACK" set to something that will point back to the server. (I used Ngrok.)

You'll also need an .env file in 'budget-buddy' with "REACT_APP_USER_ID" set to the same thing as the other .env

To run client:
- cd into 'budget-buddy'
- run `npm start`
- browse to localhost:3000/BudgetTracker

TODO:

SERVER:
- A real username / authentication system
- Separate the callback from the rest of the server

CLIENT / UI:
- STRETCH left handed user preference moves it to the other side
- Completing the Simulate Priority Expenses flow should take the user to prefered payment method, acting as an in-between step for impulse purchases

BUDGET
- show over a given number of months, with presets for 1 year,or 1 month
- STRETCH holds have time limits you can set, and can be per-month or until filled
- STRETCH ability to automatically put new transactions with the same name in the same category

DATABASE:
- Switch to a different, secure database
- constraint that the parent_id can't = id?
- STRETCH  hold subcategories are the only kind that can be nested into another (non-hold) subcategory
- STRETCH user payment preference?
