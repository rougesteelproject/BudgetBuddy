To run: currently runs on port 3000

//TODO show over a given number of months, with presets for 1 year,or 1 month
//TODO SQL constraint that the parent_id can't = id?
// TODO a toggle to enable/disable reordering categories.
//DONE A preorder/save money/ hold/ "Earmark" subcategory
//  DONE change database so that there is a hold TRUE/FALSE column
//  "holds" money so that (hold)-(transactions in the subcategory)=hold limit
//  hold subcategories are the only kind that can be nested into another (non-hold) subcategory
//  Holds count against their parent category or subcategory
// TODO STRETCH holds have time limits you can set, and can be per-month or until filled
// TODO STRETCH ability to automatically put new transactions with the same name in the same category
//TODO checker of New transaction  against the budget by priority
// TODO STRETCH left handed user preference moves it to the other side
//  Category/subcategory, price
//TODO Popops for different budget levels (Recursive?)
//  TODO as you take money from lower-priority categories, the limit visibly decreses
//  TODO 1) Projected income is more than the budget and you have enough in the category
//  TODO "You have enough in (subcategory)"
//  2) You don't have enough in the category, but do have enough in the sum of this (sub)category and all others with lower priority
//  TODO "You will have $ left in (category), you will need to use money you are saving for (hold)"
//  a) Check other categories b) start including subcategories of the same category c) include (holds)
//   3) "You have enough, but only if you spend money from (category), which you marked as important"
// DONE display limits as "Spent/Limit (Sum transactions + Sum of hold limits)/ (True Limit - Priority Expenses)"
//DONE server.js route for the overflow ammount?
// DONE STRETCH Hovering over each will say something like "Your transactions" "Earmarked" "Category limit" "Priority Expenses"
// TODO user login (secure) that keeps track of user ids, their preferences
// TODO user payment preference?