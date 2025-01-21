const sqlite3 = require('sqlite3').verbose();

// Open the database connection
const db = new sqlite3.Database('budget_buddy.db', (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Create necessary tables if they don't exist
db.serialize(() => {
  // Users table to store user information and their user token
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      "user_id" TEXT NOT NULL UNIQUE,
      "user_token" TEXT, PRIMARY KEY("user_id") 
    )
  `);

  // Access tokens table for multiple financial institutions, along with cursors
  db.run(`
    CREATE TABLE IF NOT EXISTS access_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      access_token TEXT UNIQUE NOT NULL,
      item_id TEXT UNIQUE NOT NULL,
      cursor TEXT,  -- Stores the latest cursor for incremental sync
      FOREIGN KEY (user_id) REFERENCES users (user_id)
    );
  `);

  // Categories table
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      priority_value INTEGER DEFAULT 0,
      category_limit REAL DEFAULT NULL,
      user_id TEXT,
      parent_id INTEGER DEFAULT NULL,
      earmark	INTEGER NOT NULL DEFAULT 0 CHECK(2>earmark>=0),
      priority_expenses	REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users (user_id),
      FOREIGN KEY (parent_id) REFERENCES categories (id),
      UNIQUE(name, user_id) -- Ensure unique categories per user
    );
  `);

  // Transactions table
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      category_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories (id)
    );
  `); //TODO iso_currency_code

  console.log('Database tables are ready.');
});

// Function to save a transaction
function saveTransaction(transaction) {
  const { id, category_id, amount, name, date, parent_id} = transaction;

  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO transactions (id, category_id, amount, name, date, parent_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         category_id = excluded.category_id,
         amount = excluded.amount,
         name = excluded.name,
         date = excluded.date,
         parent_id = excluded.parent_id;`,
      [ id, category_id, amount, name, date, parent_id],
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

// Function to get transactions for a specific user
function getTransactions(user_id) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT t.id, t.category_id, t.amount, t.name, t.date, c.name AS category_name
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE c.user_id = ? 
      ORDER BY t.date DESC;
    `;
    db.all(sql, [user_id], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function updateTransactionCategory(transactionId, categoryId) {
  console.log('Updating transaction:', transactionId, 'to new category ID:', categoryId);
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE transactions 
      SET category_id = ? 
      WHERE id = ?
    `;
    db.run(sql, [categoryId, String(transactionId)], function (err) {
      if (err) {
        console.log('Error trying to update transaction category:', err);
        return reject(err);
      }
      console.log('Changes:', this.changes);
      if (this.changes === 0) {
        console.log('Transaction not found or no changes made.');
        return reject(new Error('Transaction not found or no changes made.'));
      }

      // Verify the update
      const verificationSql = 'SELECT * FROM transactions WHERE id = ?';
      db.get(verificationSql, [String(transactionId)], (verifyErr, row) => {
        if (verifyErr) {
          console.log('Error verifying transaction update:', verifyErr);
          return reject(verifyErr);
        }
        if (!row) {
          console.log('No transaction found with ID after update:', transactionId);
          return reject(new Error('No transaction found after update.'));
        }
        console.log('Transaction successfully updated:', row);
        resolve();
      });
    });
  });
}

// Function to get categories with transaction sums for a specific user
function getCategories(userId) {
  return new Promise((resolve, reject) => {
    const sql = `
    WITH RecursiveCategorySum AS (
      SELECT 
        c.id AS id,
        c.parent_id AS parent_id,
        c.name AS name,
        c.priority_value AS priority_value,
        c.category_limit AS category_limit,
        SUM(t.amount) AS sum
      FROM categories c
      LEFT JOIN transactions t ON c.id = t.category_id
      WHERE c.user_id = ?
      GROUP BY c.id
      UNION ALL
      SELECT 
        c.id AS id,
        c.parent_id AS parent_id,
        c.name AS name,
        c.priority_value AS priority_value,
        c.category_limit AS category_limit,
        rcs.sum AS sum
      FROM categories c
      JOIN RecursiveCategorySum rcs ON c.parent_id = rcs.id
    )
    SELECT 
      id,
      name,
      parent_id,
      priority_value,
      category_limit,
      SUM(sum) AS total_sum
    FROM RecursiveCategorySum
    GROUP BY id;
    `;

    db.all(sql, [userId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function getCategoriesWithCustomTotals(user_id, callback) {
  const query = `
    WITH SubcategoryData AS (
      SELECT 
        sc.id, 
        sc.parent_id, 
        sc.name, 
        sc.priority_value, 
        sc.category_limit,
        IFNULL(SUM(t.amount), 0) AS total_transactions,
        IFNULL(sc.priority_expenses, 0) AS priority_expenses,
        sc.earmark
      FROM categories sc
      LEFT JOIN transactions t ON t.category_id = sc.id
      WHERE sc.user_id = ? 
      GROUP BY sc.id
    ),
    CategoryData AS (
      SELECT 
        c.id AS category_id, 
        c.name AS category_name, 
        c.category_limit,
        SUM(sd.total_transactions) AS total_transactions,
        SUM(sd.priority_expenses) AS total_priority_expenses,
        SUM(CASE WHEN sd.earmark = 1 THEN sd.category_limit ELSE 0 END) AS earmarked_limit
      FROM categories c
      LEFT JOIN SubcategoryData sd ON c.id = sd.parent_id
      WHERE c.user_id = ?
      GROUP BY c.id
    )
    SELECT 
      cd.category_id,
      cd.category_name,
      cd.total_transactions,
      cd.earmarked_limit,
      cd.category_limit,
      cd.total_priority_expenses
    FROM CategoryData cd;
  `;

  db.all(query, [user_id, user_id], (err, rows) => {
    if (err) {
      console.error("Error executing query:", err);
      callback(err, null);
    } else {
      callback(null, rows);
    }
  });
}

async function getCategoriesWithLimitsAndPriority(user_id) {  
  return new Promise((resolve, reject) => {  
   const query = `  
    SELECT  
      c.id,  
      c.name,  
      c.parent_id,  
      c.priority_value,  
      c.category_limit,  
      c.earmark,  
      c.priority_expenses,  
      IFNULL(SUM(t.amount), 0) AS total_transactions  
    FROM categories c  
    LEFT JOIN transactions t ON t.category_id = c.id  
    WHERE c.user_id = ?  
    GROUP BY c.id, c.name, c.parent_id, c.priority_value, c.category_limit, c.earmark, c.priority_expenses  
    ORDER BY c.priority_value DESC;  
   `;  
  
   db.all(query, [user_id], (err, rows) => {  
    if (err) {  
      reject(err); // Propagate error  
    } else {  
      resolve(rows); // Resolve with fetched rows  
    }  
   });  
  });  
}

// Function to create a new category
function createCategory(name, user_id, priority_value = 0, category_limit = null, parent_id=null) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO categories (name, user_id, priority_value, category_limit, parent_id) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        user_id = excluded.user_id,
        priority_value = excluded.priority_value,
        category_limit = excluded.category_limit,
        parent_id = excluded.parent_id`,
      [name, user_id, priority_value, category_limit, parent_id],
      function (err) {
        if (err) {
          return reject(err);
        }
        resolve(this.lastID); // Return the new category's ID
      }
    );
  });
}

// Function to update an existing category
function updateCategory(id, name) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE categories SET name = ? WHERE id = ?`,
      [name, id],
      function (err) {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

async function reorderCategories(updates) {
  try {
    const results = await Promise.all(
      updates.map(({ id, priority_value }) =>
        new Promise((resolve, reject) => {
          db.run(
            `UPDATE categories SET priority_value = ? WHERE id = ?`,
            [priority_value, id],
            function (err) {
              if (err) {
                reject(err);
              } else {
                resolve({ id, changes: this.changes });
              }
            }
          );
        })
      )
    );
    console.log('Categories reordered successfully:', results);
    return results;
  } catch (error) {
    console.error('Error reordering categories:', error);
    throw error;
  }
}

async function reorderSubcategories(updates) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      try {
        updates.forEach(({ id, priority_value, parent_id }) => {
          db.run(
            `UPDATE categories SET priority_value = ?, parent_id = ? WHERE id = ?`,
            [priority_value, parent_id || null, id],
            function (err) {
              if (err) throw err;
            }
          );
        });
        db.run('COMMIT', (commitErr) => {
          if (commitErr) throw commitErr;
          console.log('Subcategories reordered successfully.');
          resolve();
        });
      } catch (error) {
        db.run('ROLLBACK');
        console.error('Error reordering subcategories:', error);
        reject(error);
      }
    });
  });
}


async function getSubcategoriesWithTransactions(user_id) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        sc.id, 
        sc.name, 
        sc.parent_id, 
        sc.priority_value, 
        sc.category_limit,
        IFNULL(SUM(t.amount), 0) AS total_transactions,
        IFNULL(sc.priority_expenses, 0) AS priority_expenses
      FROM categories sc
      LEFT JOIN transactions t ON t.category_id = sc.id
      WHERE sc.user_id = ? AND sc.parent_id IS NOT NULL
      GROUP BY sc.id, sc.name, sc.parent_id, sc.priority_value, sc.category_limit
      ORDER BY sc.priority_value DESC;
    `;

    db.all(query, [user_id], (err, rows) => {
      if (err) {
        reject(err); // Pass the error to the caller
      } else {
        resolve(rows); // Resolve the rows successfully
      }
    });
  });
}

async function updateSubcategoryExpenses(subcategoryId, newExpenses) {
  const query = `
    UPDATE categories
    SET priority_expenses = ?
    WHERE id = ?;
  `;

  await db.run(query, [newExpenses, subcategoryId]);
}


function getCategoryId(category_name, user_id, priority_value = 0, category_limit = null, parent_id = null) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO categories (name, user_id) VALUES (?, ?) 
       ON CONFLICT(name) DO NOTHING`,
      [category_name, user_id],
      function (err) {
        if (err) {
          return reject(err);
        }

        db.get(
          `SELECT id FROM categories WHERE name = ? AND user_id = ?`,
          [category_name, user_id],
          async (err, row) => {
            if (err) {
              return reject(err);
            }
            if (row) {
              resolve(row.id);
            } else {
              try {
                const newCategoryId = await createCategory(category_name, user_id, priority_value, category_limit, parent_id);
                resolve(newCategoryId);
              } catch (createErr) {
                reject(createErr);
              }
            }
          }
        );
      }
    );
  });
}

async function updateParentId(categoryId, parentId) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE categories SET parent_id = ? WHERE id = ?`,
      [parentId, categoryId],
      function (err) {
        if (err) reject(err);
        resolve({ changes: this.changes });
      }
    );
  });
}

async function updateCategoryLimit(categoryId, newLimit) {
  return new Promise((resolve, reject) => {
    db.get(
      `
      SELECT SUM(category_limit) AS totalSubcategoryLimits
      FROM categories
      WHERE parent_id = ?
      `,
      [categoryId],
      (err, row) => {
        if (err) return reject(err);
        const totalSubcategoryLimits = row.totalSubcategoryLimits || 0;

        if (newLimit < totalSubcategoryLimits) {
          return reject(
            new Error('Category limit cannot be less than the sum of subcategory limits.')
          );
        }

        db.run(
          `UPDATE categories SET category_limit = ? WHERE id = ?`,
          [newLimit, categoryId],
          function (err) {
            if (err) reject(err);
            resolve({ id: categoryId, newLimit });
          }
        );
      }
    );
  });
}

// Function to get all access tokens and cursors for a user
function getAccessTokensAndCursors(user_id) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT access_token, item_id, cursor FROM access_tokens WHERE user_id = ?`,
      [user_id],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows); // Returns an array of { access_token, item_id, cursor }
        }
      }
    );
  });
}

// Function to save an access token with an initial cursor
function saveAccessToken(user_id, access_token, item_id, cursor = null) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO access_tokens (user_id, access_token, item_id, cursor)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(item_id) DO UPDATE SET 
         access_token = excluded.access_token,
         cursor = excluded.cursor;`,
      [user_id, access_token, item_id, cursor],
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

// Function to save the user token
function saveUserToken(user_id, user_token) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO users (user_id, user_token) 
       VALUES (?, ?) 
       ON CONFLICT(user_id) DO UPDATE SET user_token = excluded.user_token;`,
      [user_id, user_token],
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

// Function to get the user token
function getUserToken(user_id) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT user_token FROM users WHERE user_id = ?`,
      [user_id],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row.user_token : null);
        }
      }
    );
  });
}

// Function to update the cursor for an item_id
function updateCursor(access_token, cursor) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE access_tokens 
       SET cursor = ?
       WHERE access_token = ?`,
      [cursor, access_token],
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

// Function to delete an access token (in case of item removal)
function deleteAccessToken(item_id) {
  return new Promise((resolve, reject) => {
    db.run(
      `DELETE FROM access_tokens WHERE item_id = ?`,
      [item_id],
      (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

// Get category details
function getCategory(category_id) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT id, name, category_limit, priority_expenses 
      FROM categories 
      WHERE id = ?;
    `;
    db.get(query, [category_id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Get all transactions for a specific category
function getSubcategoryTransactions(category_id) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT amount 
      FROM transactions 
      WHERE category_id = ?;
    `;
    db.all(query, [category_id], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Get already over-budget categories
function getAlreadyOverBudgetCategories() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT c.id, c.name
      FROM categories c
      LEFT JOIN transactions t ON c.id = t.category_id
      GROUP BY c.id
      HAVING IFNULL(SUM(t.amount), 0) > c.category_limit;
    `;
    db.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Get hypothetically over-budget categories if a new expense is added
async function getHypotheticallyOverBudgetCategories(category_id, price) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT c.id, c.name, (IFNULL(SUM(t.amount), 0) + ?) AS new_total
      FROM categories c
      LEFT JOIN transactions t ON c.id = t.category_id
      WHERE c.id = ?
      GROUP BY c.id
      HAVING new_total > c.category_limit;
    `;
    db.all(query, [price, category_id], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Distribute expense across priority-based categories
async function distributeExpense(category_id, price) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT id, name, category_limit, IFNULL(SUM(t.amount), 0) AS total_transactions
      FROM categories c
      LEFT JOIN transactions t ON c.id = t.category_id
      WHERE c.id != ?
      ORDER BY c.priority_value DESC;
    `;
    db.all(query, [category_id], (err, categories) => {
      if (err) return reject(err);

      const distributedCategories = [];
      let remainingPrice = price;

      for (const category of categories) {
        const available = category.category_limit - category.total_transactions;

        if (remainingPrice <= 0) break;

        const used = Math.min(available, remainingPrice);
        remainingPrice -= used;

        distributedCategories.push({
          id: category.id,
          name: category.name,
          usedAmount: used,
          remainingLimit: category.category_limit - (category.total_transactions + used),
        });
      }

      resolve(distributedCategories);
    });
  });
}

module.exports = {
  updateCursor,
  getCategoryId,
  saveTransaction,
  getTransactions,
  updateTransactionCategory,
  getAccessTokensAndCursors,
  saveAccessToken,
  deleteAccessToken,
  saveUserToken,
  getUserToken,
  getCategories,
  getCategory,
  getCategoriesWithCustomTotals,
  createCategory,
  updateCategory,
  reorderCategories,
  reorderSubcategories,
  getSubcategoriesWithTransactions,
  getSubcategoryTransactions,
  getCategoriesWithLimitsAndPriority,
  updateSubcategoryExpenses,
  updateCategoryLimit,
  updateParentId,
  getAlreadyOverBudgetCategories,
  getHypotheticallyOverBudgetCategories,
  distributeExpense
};
