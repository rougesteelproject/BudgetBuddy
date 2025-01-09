document.addEventListener('DOMContentLoaded', async () => {
  try {
    await setupPlaidLink();
    await loadCategoriesAndTransactions();
  } catch (error) {
    console.error('Error during initialization:', error);
  }
});

async function setupPlaidLink() {
  try {
    const response = await fetch('/plaid-link-token');
    const { link_token } = await response.json();

    if (!link_token) {
      console.error('Failed to retrieve link_token');
      return;
    }

    const handler = Plaid.create({
      token: link_token,
      onSuccess: async (metadata) => {
        console.log('Plaid Link completed with metadata:', metadata);
      },
      onExit: async (err, metadata) => {
        if (err && err.error_code === 'ITEM_LOGIN_REQUIRED') {
          console.log('User needs to update login details. Switching to update mode.');
          await setupPlaidLinkUpdate();
        } else if (err) {
          console.error('User exited Plaid Link with error:', err);
        } else {
          console.log('User exited Plaid Link:', metadata);
        }
      },
      onEvent: (eventName, metadata) => {
        console.log('Plaid Link event:', eventName, metadata);
      },
    });

    const plaidLinkDiv = document.getElementById('plaid-link');
    plaidLinkDiv.innerHTML = ''; 
    const button = document.createElement('button');
    button.textContent = 'Connect your bank';
    button.onclick = () => handler.open();
    plaidLinkDiv.appendChild(button);
  } catch (err) {
    console.error('Error setting up Plaid Link:', err);
  }
}

async function setupPlaidLinkUpdate() {
  try {
    const response = await fetch('/plaid-link-token-update');
    const { link_token } = await response.json();

    if (!link_token) {
      console.error('Failed to retrieve link_token for update');
      return;
    }

    const handler = Plaid.create({
      token: link_token,
      onSuccess: async (metadata) => {
        console.log('Plaid Link update completed with metadata:', metadata);
      },
      onExit: (err, metadata) => {
        if (err) {
          console.error('User exited Plaid Link update with error:', err);
        } else {
          console.log('User exited Plaid Link update:', metadata);
        }
      },
      onEvent: (eventName, metadata) => {
        console.log('Plaid Link update event:', eventName, metadata);
      },
    });

    handler.open();
  } catch (err) {
    console.error('Error setting up Plaid Link update:', err);
  }
}

async function loadCategoriesAndTransactions() {
  try {
    const response = await fetch('/transactions');
    const { categories, transactions } = await response.json();

    if (categories.length === 0 || transactions.length === 0) {
      displayNoTransactionsMessage();
    } else {
      displayCategoriesWithTransactions(categories, transactions);
      enableDragAndDrop(); // Enable drag-and-drop after rendering categories
    }
  } catch (error) {
    console.error('Error loading categories and transactions:', error);
  }
}

function displayNoTransactionsMessage() {
  const accordion = document.getElementById('accordion');
  accordion.innerHTML = 
    `<p>No transactions found. Please connect your bank to start tracking your spending.</p>`;
}

function displayCategoriesWithTransactions(categories, transactions) {
  const accordion = document.getElementById('accordion');
  accordion.innerHTML = ''; // Clear old items

  const categoryMap = new Map();

  // Separate categories into a map with subcategories and earmarks
  categories.forEach(category => {
    if (!category.parent_id) {
      categoryMap.set(category.id, { ...category, subcategories: [], earmarks: [] });
    } else {
      const parentCategory = categoryMap.get(category.parent_id);
      if (parentCategory) {
        if (category.earmark === 1) {
          parentCategory.earmarks.push(category);
        } else {
          parentCategory.subcategories.push(category);
        }
      }
    }
  });

  // Sort categories and subcategories by priority_value  
  categoryMap.forEach(category => {  
    category.subcategories.sort((a, b) => a.priority_value - b.priority_value);  
   
    const categoryTransactions = transactions.filter(t => t.category_id === category.id && !category.earmarks.find(e => e.id === t.category_id));  
    const subcategoryTransactions = category.subcategories.reduce((acc, sub) => {  
      return acc.concat(transactions.filter(t => t.category_id === sub.id && !category.earmarks.find(e => e.id === t.category_id)));  
    }, []); 
   
    const a = categoryTransactions.reduce((sum, t) => sum + t.amount, 0) + subcategoryTransactions.reduce((sum, t) => sum + t.amount, 0); // Sum of category and subcategory transactions  
    const b = category.earmarks.reduce((sum, e) => sum + e.category_limit, 0); // Sum of earmarked subcategory limits  
    const c = category.category_limit; // Category limit  
    const d = category.subcategories.reduce((sum, sub) => sum + sub.priority_expenses, 0); // Sum of subcategory priority expenses  
   
    const accordionItem = createAccordionItem(category, categoryTransactions, a, b, c, d);  

    if (category.subcategories.length > 0) {
      const subAccordion = document.createElement('div');
      subAccordion.classList.add('nested-accordion');

      category.subcategories.forEach(subcategory => {
        const subcategoryTransactions = transactions.filter(t => t.category_id === subcategory.id);  
        const subcategoryEarmarks = category.earmarks.filter(e => e.parent_id === subcategory.id);  
        const subA = subcategoryTransactions.reduce((sum, t) => sum + t.amount, 0); // Sum of subcategory transactions  
        const subB = subcategoryEarmarks.reduce((sum, e) => sum + e.category_limit, 0); // Sum of earmarked subsubcategory limits  
        const subC = subcategory.category_limit; // Subcategory limit  
        const subD = subcategory.priority_expenses; // Subcategory priority expenses  
        const subAccordionItem = createAccordionItem(subcategory, subcategoryTransactions, subA, subB, subC, subD);  
        subAccordion.appendChild(subAccordionItem);

        // Display earmark categories immediately after each subcategory
        const earmarks = category.earmarks.filter(e => e.parent_id === subcategory.id);  
        earmarks.forEach(earmark => {  
          const earmarkTransactions = transactions.filter(t => t.category_id === earmark.id);  
          const earmarkA = earmarkTransactions.reduce((sum, t) => sum + t.amount, 0); // Sum of earmark transactions  
          const earmarkB = 0; // Earmarks do not have earmarks  
          const earmarkC = earmark.category_limit; // Earmark limit  
          const earmarkD = earmark.priority_expenses; // Earmark priority expenses
          const earmarkItem = createAccordionItem(earmark, earmarkTransactions, earmarkA, earmarkB, earmarkC, earmarkD);  
          earmarkItem.classList.add('earmark');  
          subAccordion.appendChild(earmarkItem);  
        });  
      });

      accordionItem.querySelector('.accordion-content').appendChild(subAccordion);
    }

    accordion.appendChild(accordionItem);
  });
}

function createAccordionItem(category, transactions, a = 0, b = 0, c = 0, d = 0) {
  const accordionItem = document.createElement('div');
  accordionItem.classList.add('accordion-item');
  accordionItem.dataset.id = category.id; // Add dataset for sorting

  const x = ((a || 0) + (b || 0)).toFixed(2);  
  const y = ((c || 0) - (d || 0)).toFixed(2);

  const button = document.createElement('button');
  button.classList.add('accordion-button');
  button.innerHTML = `${category.name}: $${x}/$${y}`;
  
  // Tooltip for a, b, c, and d explanation  
  button.title = `Transactions: $${(a || 0).toFixed(2)}\nEarmarked: $${(b || 0).toFixed(2)}\nCategory Limit: $${(c || 0).toFixed(2)}\nPriority Expenses: $${(d || 0).toFixed(2)}`; 

  // Edit button for category name
  const editButton = document.createElement('button');
  editButton.classList.add('edit-button');
  editButton.innerHTML = '<i class="fas fa-edit"></i>'; // Font Awesome edit icon
  editButton.onclick = () => editCategory(category.id);

  const content = document.createElement('div');
  content.classList.add('accordion-content');
  content.style.display = 'none'; // Accordion hidden by default

  if (transactions.length > 0) {
    const transactionList = document.createElement('ul');
    transactions.forEach(tx => {
      const transactionItem = document.createElement('li');
      transactionItem.textContent = `${tx.date}: $${tx.amount.toFixed(2)} - ${tx.name}`;

      // Button to change category
      const changeCategoryBtn = document.createElement('button');
      changeCategoryBtn.textContent = 'Change Category';
      changeCategoryBtn.onclick = () => changeTransactionCategory(tx.id);
      transactionItem.appendChild(changeCategoryBtn);

      transactionList.appendChild(transactionItem);
    });
    content.appendChild(transactionList);
  } else {
    content.innerHTML = '<p>No transactions for this category.</p>';
  }

  button.addEventListener('click', () => {
    content.style.display = content.style.display === 'block' ? 'none' : 'block';
    button.classList.toggle('active');
  });

  accordionItem.appendChild(button);
  accordionItem.appendChild(editButton); // Add edit button
  accordionItem.appendChild(content);
  return accordionItem;
}

async function editCategory(categoryId) {
  try {
    const response = await fetch('/categories');
    const { categories } = await response.json();

    const categoryToEdit = categories.find(c => c.id === categoryId);

    const modal = document.createElement('div');
    modal.classList.add('modal');

    const modalContent = document.createElement('div');
    modalContent.classList.add('modal-content');

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Enter the new name for the category:';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = categoryToEdit.name; // Default to the current name

    const parentLabel = document.createElement('label');
    parentLabel.textContent = 'Select new parent category:';

    const parentSelect = document.createElement('select');

    const noneOption = document.createElement('option');
    noneOption.value = '';
    noneOption.textContent = 'None';
    if (!categoryToEdit.parent_id) noneOption.selected = true;
    parentSelect.appendChild(noneOption);

    categories
      .filter(c => !c.parent_id && c.id !== categoryId) // Exclude itself and categories with parents
      .forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        if (category.id === categoryToEdit.parent_id) option.selected = true; // Default selection
        parentSelect.appendChild(option);
      });

    const limitLabel = document.createElement('label');
    limitLabel.textContent = 'Set a new limit for the category:';

    const limitInput = document.createElement('input');
    limitInput.type = 'number';
    limitInput.value = categoryToEdit.limit || ''; // Default to the current limit, if set

    const submitButton = document.createElement('button');
    submitButton.textContent = 'Submit';
    submitButton.onclick = async () => {
      const newName = nameInput.value.trim();
      const newParentId = parentSelect.value || null;
      const newLimit = parseFloat(limitInput.value);
    
      if (!newName) {
        alert('Please enter a valid name.');
        return;
      }
    
      const requestBody = {};
      if (newName) requestBody.name = newName;
      if (newParentId !== null) requestBody.parent_id = newParentId;
      if (!isNaN(newLimit)) requestBody.category_limit = newLimit;
    
      await fetch(`/categories/${categoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    
      modal.remove();
      await loadCategoriesAndTransactions();
    };

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.onclick = () => modal.remove();

    modalContent.appendChild(nameLabel);
    modalContent.appendChild(nameInput);
    modalContent.appendChild(parentLabel);
    modalContent.appendChild(parentSelect);
    modalContent.appendChild(limitLabel);
    modalContent.appendChild(limitInput);
    modalContent.appendChild(submitButton);
    modalContent.appendChild(cancelButton);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
  } catch (error) {
    console.error('Error editing category:', error);
  }
}

async function createSubcategory(parentId) {
  const newName = prompt('Enter the name for the new subcategory:');
  if (newName) {
    await fetch('/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, parent_id: parentId }),
    });
    await loadCategoriesAndTransactions();
  }
}

async function changeTransactionCategory(transactionId) {
  try {
    const response = await fetch('/categories');
    const { categories } = await response.json();

    const modal = document.createElement('div');
    modal.classList.add('modal');

    const modalContent = document.createElement('div');
    modalContent.classList.add('modal-content');

    const label = document.createElement('label');
    label.textContent = 'Select a new category:';

    // Create a container for the tree
    const treeContainer = document.createElement('div');
    treeContainer.classList.add('tree-container');

    // Helper function to create tree structure
    function buildTree(categories, parentId = null) {
      const ul = document.createElement('ul');

      categories
        .filter(category => category.parent_id === parentId)
        .forEach(category => {
          const li = document.createElement('li');
          li.textContent = category.name;
          li.dataset.id = category.id;

          li.onclick = (event) => {
            event.stopPropagation();  // Prevent event bubbling to parent <li>
            Array.from(treeContainer.querySelectorAll('li')).forEach(item =>
              item.classList.remove('selected')
            );
            li.classList.add('selected');
            li.dataset.selectedId = category.id; // Store the selected category ID
          };

          // Recursively add subcategories
          const subTree = buildTree(categories, category.id);
          if (subTree) {
            li.appendChild(subTree);
          }

          ul.appendChild(li);
        });

      return ul.childElementCount > 0 ? ul : null;
    }

    const tree = buildTree(categories);
    if (tree) {
      treeContainer.appendChild(tree);
    } else {
      treeContainer.textContent = 'No categories available.';
    }

    const submitButton = document.createElement('button');
    submitButton.textContent = 'Submit';
    submitButton.onclick = async () => {
      const selected = treeContainer.querySelector('li.selected');
      if (!selected) {
        alert('Please select a category.');
        return;
      }

      const newCategoryId = selected.dataset.selectedId;

      await fetch(`/transactions/${transactionId}/change-category`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: newCategoryId }),
      });

      modal.remove();
      await loadCategoriesAndTransactions();
    };

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.onclick = () => modal.remove();

    modalContent.appendChild(label);
    modalContent.appendChild(treeContainer);
    modalContent.appendChild(submitButton);
    modalContent.appendChild(cancelButton);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
  } catch (error) {
    console.error('Error changing transaction category:', error);
  }
}

function enableDragAndDrop() {
  const accordion = document.getElementById('accordion');

  // Enable drag-and-drop for top-level categories
  new Sortable(accordion, {
    group: 'categories',
    animation: 150,
    onEnd: async function (event) {
      const sortedItems = [];
      const allAccordionItems = Array.from(accordion.children);

      // Loop through top-level categories and their nested items (subcategories and earmarks)
      allAccordionItems.forEach((item, index) => {
        sortedItems.push({
          id: item.dataset.id,
          priority_value: index + 1,
        });

        // Handle nested subcategories
        const nestedAccordion = item.querySelector('.nested-accordion');
        if (nestedAccordion) {
          const subcategories = Array.from(nestedAccordion.children);

          subcategories.forEach((subItem, subIndex) => {
            sortedItems.push({
              id: subItem.dataset.id,
              priority_value: subIndex + 1,
              parent_id: item.dataset.id,
            });

            // Include earmarks that are linked to this subcategory
            const earmarks = subItem.querySelectorAll('.earmark');
            earmarks.forEach((earmarkItem, earmarkIndex) => {
              sortedItems.push({
                id: earmarkItem.dataset.id,
                priority_value: subIndex + 1, // Same as the parent subcategory
                parent_id: subItem.dataset.id,
              });
            });
          });
        }
      });

      try {
        await fetch('/categories/reorder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: sortedItems }),
        });
        console.log('Categories, subcategories, and earmarks reordered successfully.');
      } catch (error) {
        console.error('Error reordering items:', error);
      }
    },
  });

  // Enable drag-and-drop for subcategories
  document.querySelectorAll('.nested-accordion').forEach(nestedAccordion => {
    new Sortable(nestedAccordion, {
      group: 'subcategories',
      animation: 150,
      onEnd: async function (event) {
        const parentId = nestedAccordion.closest('.accordion-item').dataset.id;
        const sortedSubcategories = [];
        const allSubcategories = Array.from(nestedAccordion.children);

        allSubcategories.forEach((item, index) => {
          sortedSubcategories.push({
            id: item.dataset.id,
            priority_value: index + 1,
            parent_id: parentId,
          });

          // Include earmarks tied to this subcategory
          const earmarks = item.querySelectorAll('.earmark');
          earmarks.forEach((earmarkItem) => {
            sortedSubcategories.push({
              id: earmarkItem.dataset.id,
              priority_value: index + 1, // Match parent's priority
              parent_id: item.dataset.id,
            });
          });
        });

        try {
          await fetch('/subcategories/reorder', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: sortedSubcategories }),
          });
          console.log('Subcategories and earmarks reordered successfully.');
        } catch (error) {
          console.error('Error reordering subcategories:', error);
        }
      },
    });
  });
}

const addButton = document.createElement('button');
addButton.textContent = 'Add Expense';
addButton.style.position = 'fixed';
addButton.style.bottom = '20px';
addButton.style.right = '20px';
document.body.appendChild(addButton);

addButton.addEventListener('click', async () => {
  try {
    const response = await fetch('/categories');
    const { categories } = await response.json();

    const modal = document.createElement('div');
    modal.classList.add('modal');

    const modalContent = document.createElement('div');
    modalContent.classList.add('modal-content');

    const label = document.createElement('label');
    label.textContent = 'Select a category:';

    // Tree container
    const treeContainer = document.createElement('div');
    treeContainer.classList.add('tree-container');

    // Build the tree of categories
    function buildTree(categories) {
      const ul = document.createElement('ul');

      categories.forEach(category => {
        const li = document.createElement('li');
        li.textContent = category.name;
        li.dataset.id = category.id;

        li.onclick = (event) => {
          event.stopPropagation(); // Prevent event bubbling
          Array.from(treeContainer.querySelectorAll('li')).forEach(item =>
            item.classList.remove('selected')
          );
          li.classList.add('selected');
          li.dataset.selectedId = category.id;
        };

        ul.appendChild(li);
      });

      return ul;
    }

    const tree = buildTree(categories);
    treeContainer.appendChild(tree);

    // Price input field
    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.placeholder = 'Enter price';

    const submitButton = document.createElement('button');
    submitButton.textContent = 'Submit';
    submitButton.onclick = async () => {
      const selected = treeContainer.querySelector('li.selected');
      const price = parseFloat(priceInput.value);

      if (!selected || isNaN(price) || price <= 0) {
        alert('Please select a category and enter a valid price.');
        return;
      }

      const categoryId = selected.dataset.selectedId;

      try {
        const response = await fetch('/check-expense', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category_id: categoryId, price }),
        });

        const data = await response.json();
        if (data.success) {
          alert('Expense added successfully!');
        } else {
          alert('Error adding expense.');
        }
      } catch (error) {
        console.error('Error submitting expense:', error);
      }

      modal.remove(); // Close modal
    };

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.onclick = () => modal.remove();

    modalContent.appendChild(label);
    modalContent.appendChild(treeContainer);
    modalContent.appendChild(priceInput);
    modalContent.appendChild(submitButton);
    modalContent.appendChild(cancelButton);

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

  } catch (error) {
    console.error('Error fetching categories:', error);
  }
});
