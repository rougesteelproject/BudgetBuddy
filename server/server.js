const fastify = require('fastify')({ logger: true });
const path = require('path');
const db = require('./db');
const plaidClient = require('./plaid');
require('dotenv').config();


// Routes

fastify.register(require('@fastify/cors'), {
  origin: true,
  methods: ['GET', 'POST'],
});


fastify.get('/api/create_link_token', async (req, reply) => {
  try {
    // Example: Get the user ID from the session or request context
    const userId = process.env.USER_ID;  // Assuming user_id is stored in the session after login

    if (!userId) {
      return reply.status(400).send({ error: 'User ID is required' });
    }

    // Check if user already has a user_token
    let userToken = await db.getUserToken(userId); // Assume a DB method to get the user token

    // If the user token does not exist, create it
    if (!userToken) {
      const userCreateResponse = await plaidClient.userCreate({
        client_user_id: userId,
      });
      userToken = userCreateResponse.data.user_token;
      await db.saveUserToken(userId, userToken);
    }

    console.log('Attempting to create Plaid link token for user:', userId);

    const response = await plaidClient.linkTokenCreate({
      enable_multi_item_link: true,
      user: {"client_user_id": userId,},
      user_token:  userToken,
      client_name: "Budget Buddy",
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
      webhook: process.env.CALLBACK + 'plaid-webhook'
    });

    console.log('Link token created successfully for user:', userId);
    reply.send({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Error in creating Plaid link token:', error);
    reply.status(500).send({ error: 'Failed to create link token' });
  }
});

fastify.get('/plaid-link-token-update', async (req, reply) => {
  try {
    const userId = process.env.USER_ID; // Assuming user_id is stored in the session after login

    if (!userId) {
      return reply.status(400).send({ error: 'User ID is required' });
    }

    const accessTokensAndCursors = await db.getAccessTokensAndCursors(userId);
    if (accessTokensAndCursors.length === 0) {
      return reply.status(400).send({ error: 'No access tokens found for user' });
    }

    const updateLinks = [];
    for (const { access_token } of accessTokensAndCursors) {
      const response = await plaidClient.linkTokenCreate({
        user: { client_user_id: userId },
        client_name: "Budget Buddy",
        country_codes: ['US'],
        language: 'en',
        webhook: process.env.CALLBACK + 'plaid-webhook',
        access_token,
      });
      updateLinks.push({ access_token, link_token: response.data.link_token });
    }

    reply.send({ updateLinks });
  } catch (error) {
    console.error('Error in creating Plaid update link tokens:', error);
    reply.status(500).send({ error: 'Failed to create update link tokens' });
  }
});

fastify.get('/api/access-tokens', async (req, reply) => {
  try {
    const userId = process.env.USER_ID; // Retrieve user ID dynamically

    if (!userId) {
      return reply.status(400).send({ error: 'User ID is required' });
    }

    const accessTokensAndCursors = await db.getAccessTokensAndCursors(userId);
    reply.send({ accessTokensAndCursors });
  } catch (error) {
    console.error('Error fetching access tokens:', error);
    reply.status(500).send({ error: 'Failed to fetch access tokens' });
  }
});

// Remove a Plaid Item
fastify.delete('/item/remove', async (request, reply) => {
  const { access_token } = request.body;

  if (!access_token) {
    return reply.status(400).send({ error: 'Access token is required.' });
  }

  try {
    // Call Plaid's itemRemove method
    await plaidClient.itemRemove({ access_token });

    // Remove the access token and associated item from the database
    const userId = process.env.USER_ID; // Replace with actual user ID logic
    await db.removeAccessToken(userId, access_token);

    reply.send({ success: true, message: 'Item removed successfully.' });
  } catch (error) {
    console.error('Error removing item:', error);
    reply.status(500).send({ error: 'Failed to remove item.' });
  }
});

fastify.post('/plaid-webhook', async (request, reply) => {
  const { webhook_type, webhook_code, link_session_id, public_tokens } = request.body;

  if (webhook_type === 'LINK' && webhook_code === 'SESSION_FINISHED') {
    console.log('SESSION_FINISHED webhook received:', request.body);

    if (Array.isArray(public_tokens) && public_tokens.length > 0) {
      try {
        for (const publicToken of public_tokens) {
          // Exchange the public_token for an access_token
          const exchangeResponse = await plaidClient.itemPublicTokenExchange({
            public_token: publicToken,
          });

          const accessToken = exchangeResponse.data.access_token;
          const itemId = exchangeResponse.data.item_id;

          console.log('Access token obtained:', accessToken);

          // Save the access_token and item_id in your database
          const userId = process.env.USER_ID; // Replace with dynamic user ID retrieval
          await db.saveAccessToken(userId, accessToken, itemId);
        }
      } catch (error) {
        console.error('Error exchanging public token:', error);
        return reply.status(500).send('Failed to exchange public token');
      }
    }

    reply.status(200).send('Webhook received');
  } else {
    console.log('Unhandled webhook:', request.body);
    reply.status(200).send('Webhook received');
  }
});

// Fetch and store transactions for a specific access token
async function fetchAndStoreTransactions(access_token, cursor) {
  let hasMore = true;
  let newCursor = cursor;

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token,
      cursor: newCursor,
    });

    console.log("transactionSync response:", response);

    const transactions = response.data.added;
    const removedTransactions = response.data.removed;

    // Save new transactions in the database
    for (const transaction of transactions) {
      const categoryId = await db.getCategoryId(transaction.personal_finance_category.primary || 'Uncategorized', process.env.USER_ID, );
      console.log(transaction.name, transaction.transaction_id);
      await db.saveTransaction({
        id: String(transaction.transaction_id),
        category_id: categoryId,
        //TODO add transaction.iso_currency_code
        amount: transaction.amount,
        name: (transaction.name || transaction.merchant_name) || "name_unknown",
        date: transaction.date //TODO switch to datetime
      });
    }

    // Optionally, handle removed transactions here

    newCursor = response.data.next_cursor;
    hasMore = response.data.has_more;
  }

  // Update the cursor in the database
  await db.updateCursor(access_token, newCursor);
}

async function redistributeExpenses(user_id) {
  try {
    // Step 1: Retrieve all categories and their subcategories with priorities, limits, and transactions
    const categories = await db.getCategoriesWithLimitsAndPriority(user_id);
    const subcategories = await db.getSubcategoriesWithTransactions(user_id);

    // Step 2: Sort categories and subcategories
    const sortedCategories = categories.sort((a, b) => b.priority_value - a.priority_value); // Descending priority
    const sortedSubcategories = subcategories.sort((a, b) => b.priority_value - a.priority_value);

    // Step 3: For each category 'a' (from highest to lowest priority)
    for (const categoryA of sortedCategories) {
      const categoryATotal = categoryA.total_transactions || 0;
      const categoryLimit = categoryA.category_limit;

      if (categoryATotal <= categoryLimit) continue; // Skip if not over the limit

      const overLimitAmount = categoryATotal - categoryLimit;

      // Step 4: Check subcategories of 'a' for their totals
      for (const subcategory of sortedSubcategories.filter(sc => sc.parent_id === categoryA.id)) {
        const subcategoryTotal = subcategory.total_transactions || 0;
        if (subcategoryTotal + categoryATotal <= categoryLimit) continue; // If within limit, skip
      }

      // Step 5: Redistribute over-limit to lower-priority categories and subcategories
      let remainingOverLimit = overLimitAmount;

      const lowerPriorityCategories = sortedCategories.filter(c => c.priority_value < categoryA.priority_value);

      for (const categoryB of lowerPriorityCategories.sort((a, b) => a.priority_value - b.priority_value)) {
        const categoryBSubcategories = sortedSubcategories.filter(sc => sc.parent_id === categoryB.id);

        for (const subcategoryB of categoryBSubcategories.sort((a, b) => a.priority_value - b.priority_value)) {
          const currentExpenses = subcategoryB.priority_expenses || 0;
          const subcategoryLimit = subcategoryB.category_limit;

          const spaceLeft = subcategoryLimit - currentExpenses;

          if (spaceLeft > 0) {
            const transferAmount = Math.min(remainingOverLimit, spaceLeft);
            remainingOverLimit -= transferAmount;

            // Update the priority_expenses for subcategory 'b'
            await db.updateSubcategoryExpenses(subcategoryB.id, currentExpenses + transferAmount);

            if (remainingOverLimit <= 0) break;
          }
        }

        if (remainingOverLimit <= 0) break;
      }
    }
  } catch (error) {
    console.error('Error redistributing expenses:', error);
  }
}

fastify.get('/api/transactions', async (request, reply) => {
  try {
    const user_id = process.env.USER_ID;

    const accessTokensAndCursors = await db.getAccessTokensAndCursors(user_id);

    for (const { access_token, cursor } of accessTokensAndCursors) {
      await fetchAndStoreTransactions(access_token, cursor, user_id);
    }

    await db.recalculatePriorityExpenses(user_id);

    const categories = await db.getCategoriesWithLimitsAndPriority(user_id);
    const transactions = await db.getTransactions(user_id);

    console.log('Fetched categories:', categories);
    console.log('Fetched transactions:', transactions);

    reply.send({ categories, transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    reply.status(500).send({ error: 'Server: Failed to fetch transactions' });
  }
});

//Change the category of a transaction
fastify.put('/api/transactions/:transactionId/change-category', async (request, reply) => {
  const { transactionId } = request.params;
  const { category_id } = request.body;

  if (!category_id) {
    return reply.status(400).send({ error: 'Category ID is required.' });
  }

  try {
    await db.updateTransactionCategory(transactionId, category_id);
    await db.recalculatePriorityExpenses(process.env.USER_ID);
    reply.send({ success: true, message: 'Transaction category updated successfully.' });
  } catch (err) {
    console.error('Error updating transaction category:', err);
    if (err.message.includes('Transaction not found')) {
      return reply.status(404).send({ error: 'Transaction not found.' });
    }
    reply.status(500).send({ error: 'Unable to update transaction category.' });
  }
});

//Get existing categories
fastify.get('/categories', async (request, reply) => {
  try {
    const categories = await db.getCategories(process.env.USER_ID);
    reply.send({ categories }); // Send categories as a JSON object.
  } catch (err) {
    console.error('Error fetching categories:', err);
    reply.status(500).send({ error: 'Unable to fetch categories' });
  }
});

//New Category
fastify.post('/categories/new', async (request, reply) => {
  const { name, user_id, category_limit, parent_id } = request.body;

  try {
    const categoryId = await db.createCategory(name, process.env.USER_ID, category_limit, parent_id);

    reply.send({ success: true, categoryId });
  } catch (error) {
    console.error('Error creating category:', error);
    reply.status(500).send({ error: 'Failed to create category' });
  }
});

// Update a category
fastify.put('/categories/:id', async (request, reply) => {
  const { id } = request.params;
  const { name, parent_id, category_limit, priority_value } = request.body;

  try {
    const promises = [];

    if (name) {
      promises.push(db.updateCategory(id, name));
    }

    if (parent_id !== undefined) {
      // Check if the new parent category already has a parent
      const parentCategory = await db.getCategory(parent_id);
      if (parentCategory && parentCategory.parent_id) {
        return reply.status(400).send({ error: 'Cannot set a category with a parent as the new parent.' });
      }
      promises.push(db.updateParentId(id, parent_id || null));
    }

    if (category_limit !== undefined) {
      promises.push(db.updateCategoryLimit(id, category_limit));
    }

    if (priority_value !== undefined) {
      promises.push(db.updateCategoryPriority(id, priority_value));
    }

    await Promise.all(promises);
    await db.recalculatePriorityExpenses(process.env.USER_ID);

    reply.send({ success: true, message: 'Category updated successfully' });
  } catch (error) {
    console.error('Error updating category:', error);
    reply.status(500).send({ error: 'Failed to update category' });
  }
});

fastify.put('/categories/reorder', async (request, reply) => {
  const { updates } = request.body; // [{ id, priority_value }]

  try {
    await db.reorderCategories(updates);
    reply.send({ success: true });
  } catch (error) {
    console.error('Error reordering categories:', error);
    reply.status(500).send({ error: 'Failed to reorder categories' });
  }
});

fastify.put('/subcategories/reorder', async (request, reply) => {
  const { updates } = request.body; // [{ id, priority_value, parent_id }]

  try {
    await db.reorderSubcategories(updates);
    reply.send({ success: true });
  } catch (error) {
    console.error('Error reordering subcategories:', error);
    reply.status(500).send({ error: 'Failed to reorder subcategories' });
  }
});

// Simulate priority expenses
fastify.post('/simulate-priority-expenses', async (request, reply) => {
  const { category_id, amount, include_earmarked } = request.body;

  try {
    const result = await simulatePriorityExpenses(category_id, amount, include_earmarked);
    reply.send({ success: true, message: result });
  } catch (error) {
    console.error('Error simulating priority expenses:', error);
    reply.status(500).send({ error: 'Failed to simulate priority expenses' });
  }
});

async function simulatePriorityExpenses(category_id, amount, include_earmarked) {
  const user_id = process.env.USER_ID;
  const categories = await db.getCategoriesWithLimitsAndPriority(user_id);
  const subcategories = await db.getSubcategoriesWithTransactions(user_id);

  const sortedCategories = categories.sort((a, b) => a.priority_value - b.priority_value);
  const sortedSubcategories = subcategories.sort((a, b) => a.priority_value - b.priority_value);

  let remainingAmount = amount;
  let result = '';

  for (const category of sortedCategories) {
    if (category.id === category_id) {
      const categoryTotal = category.total_transactions || 0;
      const categoryLimit = category.category_limit;

      if (categoryTotal + remainingAmount <= categoryLimit) {
        result += `The selected category ${category.name} will not be over budget.\n`;
        break;
      } else {
        const overLimitAmount = categoryTotal + remainingAmount - categoryLimit;
        result += `The selected category ${category.name} will be over budget by ${overLimitAmount}.\n`;
        remainingAmount = overLimitAmount;
      }
    }

    for (const subcategory of sortedSubcategories.filter(sc => sc.parent_id === category.id)) {
      if (!include_earmarked && subcategory.earmark) continue;

      const subcategoryTotal = subcategory.total_transactions || 0;
      const subcategoryLimit = subcategory.category_limit;

      if (subcategoryTotal + remainingAmount <= subcategoryLimit) {
        result += `Subcategory ${subcategory.name} will not be over budget.\n`;
        break;
      } else {
        const overLimitAmount = subcategoryTotal + remainingAmount - subcategoryLimit;
        result += `Subcategory ${subcategory.name} will be over budget by ${overLimitAmount}.\n`;
        remainingAmount = overLimitAmount;
      }
    }
  }

  if (remainingAmount > 0) {
    result += `All categories are filled, and ${remainingAmount} remains unallocated.\n`;
  }

  return result;
}

fastify.post('/check-expense', async (request, reply) => {  
  const { category_id, price } = request.body;  
  
  try {  
   const category = await db.getCategory(category_id);  
   const subcategoryTransactions = await db.getSubcategoryTransactions(category_id);  
   const subcategoryLimit = category.category_limit;  
   const priorityExpenses = category.priority_expenses;  
  
   const totalTransactions = subcategoryTransactions.reduce((sum, t) => sum + t.amount, 0);  
   const newTotal = totalTransactions + price;  
  
   if (newTotal <= subcategoryLimit) {  
    return reply.send({ success: true, message: `You have enough in ${category.name}` });  
   }  
  
   const alreadyOverBudgetCategories = await db.getAlreadyOverBudgetCategories();  
   const hypotheticallyOverBudgetCategories = await db.getHypotheticallyOverBudgetCategories(category_id, price);  
  
   const message = `You will have $$${subcategoryLimit - newTotal} left in$$ {category.name}. You will need to use money you are saving for ${hypotheticallyOverBudgetCategories.map(c => c.name).join(', ')}. You will have nothing left in ${alreadyOverBudgetCategories.map(c => c.name).join(', ')}.`;  
  
   if (alreadyOverBudgetCategories.length > 0 || hypotheticallyOverBudgetCategories.length > 0) {  
    const distributedCategories = await db.distributeExpense(category_id, price);  
    const lastDistributedCategory = distributedCategories[distributedCategories.length - 1];  
  
    message += ` You will have $$${lastDistributedCategory.category_limit - lastDistributedCategory.total_transactions} left in$$ {lastDistributedCategory.name} and take everything from ${distributedCategories.map(c => c.name).join(', ')}, which you marked as more important.`;  
   }  
  
   return reply.send({ success: true, message });  
  } catch (error) {  
   console.error('Error checking expense:', error);  
   return reply.send({ success: false, message: 'Error checking expense.' });  
  }  
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: '127.0.0.1' });
    console.log('Server listening on http://localhost:3001');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

