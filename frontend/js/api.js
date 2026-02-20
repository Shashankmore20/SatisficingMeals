// Centralized API client - all fetch calls go through here

const BASE = "/api";

async function request(method, path, body = null) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export const api = {
  // Auth
  signup: (body) => request("POST", "/auth/signup", body),
  login: (body) => request("POST", "/auth/login", body),
  logout: () => request("POST", "/auth/logout"),
  getMe: () => request("GET", "/auth/me"),

  // Pantry
  getPantry: () => request("GET", "/pantry"),
  addPantryItem: (body) => request("POST", "/pantry", body),
  updatePantryItem: (id, body) => request("PUT", `/pantry/${id}`, body),
  deletePantryItem: (id) => request("DELETE", `/pantry/${id}`),
  getExpiring: () => request("GET", "/pantry/expiring"),
  suggestExpiry: (ingredient) =>
    request("GET", `/pantry/suggest-expiry/${encodeURIComponent(ingredient)}`),
  searchIngredients: (q) =>
    request("GET", `/pantry/search-ingredients?q=${encodeURIComponent(q)}`),
  addIngredient: (body) => request("POST", "/pantry/add-ingredient", body),

  // Recipes
  getRecipes: () => request("GET", "/recipes"),
  getDailyRecipes: () => request("GET", "/recipes/daily"),
  getRecipeSuggestions: () => request("GET", "/recipes/suggestions"),
  getRecipePrep: (name) =>
    request("GET", `/recipes/${encodeURIComponent(name)}/prep`),

  // Shopping
  getShoppingLists: () => request("GET", "/shopping"),
  createShoppingList: (body) => request("POST", "/shopping", body),
  updateShoppingList: (id, body) => request("PUT", `/shopping/${id}`, body),
  deleteShoppingList: (id) => request("DELETE", `/shopping/${id}`),
  toggleShoppingItem: (id, idx) =>
    request("POST", `/shopping/${id}/check/${idx}`),
  moveToPantry: (id) => request("POST", `/shopping/${id}/move-to-pantry`),
  getPurchaseHistory: () => request("GET", "/shopping/history"),

  // Images
  getImage: (query) => request("GET", `/images/${encodeURIComponent(query)}`),

  // Wikipedia
  getWikipedia: (term) =>
    request("GET", `/wikipedia/${encodeURIComponent(term)}`),
};
