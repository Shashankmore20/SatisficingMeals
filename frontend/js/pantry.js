import { api } from "./api.js";
import { showWikiModal } from "./wikipedia.js";

let pantryItems = [];
let currentFilter = "all";

export async function initPantry() {
  await loadPantry();
  setupPantryForm();
  setupFilters();
}

async function loadPantry() {
  try {
    pantryItems = await api.getPantry();
    renderPantry();
  } catch (err) {
    console.error("Failed to load pantry:", err);
  }
}

function renderPantry() {
  const container = document.getElementById("pantry-list");
  const now = new Date();
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let filtered = pantryItems;

  if (currentFilter === "expiring-soon") {
    filtered = pantryItems.filter((item) => {
      if (!item.expiration_date) return false;
      const exp = new Date(item.expiration_date);
      return exp >= now && exp <= sevenDays;
    });
  } else if (currentFilter === "expired") {
    filtered = pantryItems.filter((item) => {
      if (!item.expiration_date) return false;
      return new Date(item.expiration_date) < now;
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `<p class="empty-state">No items to show.</p>`;
    return;
  }

  container.innerHTML = filtered
    .map((item) => {
      const exp = item.expiration_date ? new Date(item.expiration_date) : null;
      let expiryClass = "";
      let expiryText = item.expiration_date || "No expiry";

      if (exp) {
        if (exp < now) {
          expiryClass = "expired";
          expiryText = `Expired ${item.expiration_date}`;
        } else if (exp <= threeDays) {
          expiryClass = "expiring-critical";
          expiryText = `⚠️ Expires ${item.expiration_date}`;
        } else if (exp <= sevenDays) {
          expiryClass = "expiring-soon";
          expiryText = `Expires ${item.expiration_date}`;
        }
      }

      return `
      <div class="pantry-item ${expiryClass}" data-id="${item._id}">
        <div class="pantry-item-main">
          <span class="pantry-ingredient">${capitalize(item.ingredient)}</span>
          <span class="pantry-qty">${item.quantity} ${item.unit}</span>
        </div>
        <div class="pantry-item-meta">
          <span class="pantry-expiry ${expiryClass}">${expiryText}</span>
        </div>
        <div class="pantry-item-actions">
          <button class="btn-icon" title="Look up on Wikipedia" onclick="window.lookupWiki('${item.ingredient}')">🔍</button>
          <button class="btn-icon" title="Edit item" onclick="window.editPantryItem('${item._id}')">✏️</button>
          <button class="btn-icon btn-danger" title="Delete item" onclick="window.deletePantryItem('${item._id}')">🗑️</button>
        </div>
      </div>
    `;
    })
    .join("");
}

function setupFilters() {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;
      renderPantry();
    });
  });
}

function setupPantryForm() {
  const addBtn = document.getElementById("add-pantry-btn");
  const cancelBtn = document.getElementById("cancel-pantry");
  const formContainer = document.getElementById("pantry-form-container");
  const form = document.getElementById("pantry-form");
  const ingredientInput = document.getElementById("pantry-ingredient");
  const expiryInput = document.getElementById("pantry-expiry");

  addBtn.addEventListener("click", () => {
    formContainer.classList.remove("hidden");
    ingredientInput.focus();
  });

  cancelBtn.addEventListener("click", () => {
    formContainer.classList.add("hidden");
    form.reset();
  });

  // Auto-suggest expiry when ingredient is entered
  let debounceTimer;
  ingredientInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const val = ingredientInput.value.trim();
      if (val.length < 2) return;

      try {
        const { expiration_date } = await api.suggestExpiry(val);
        if (expiration_date && !expiryInput.value) {
          expiryInput.value = expiration_date;
          expiryInput.placeholder = `Suggested: ${expiration_date}`;
        }
      } catch {
        // Ingredient not in DB, that's fine
      }
    }, 400);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ingredient = ingredientInput.value.trim();
    const quantity = document.getElementById("pantry-qty").value;
    const unit = document.getElementById("pantry-unit").value;
    const expiration_date = expiryInput.value.trim();

    try {
      // Check if ingredient exists, offer to add if not
      const result = await api.suggestExpiry(ingredient);
      if (result.expiration_date === null) {
        const add = confirm(
          `"${ingredient}" isn't in our database yet. Add it with this expiry date? You can leave expiry blank.`
        );
        if (add) {
          await api.addIngredient({ ingredient, expiration_date: expiration_date || null });
        }
      }

      await api.addPantryItem({ ingredient, quantity, unit, expiration_date: expiration_date || null });
      form.reset();
      formContainer.classList.add("hidden");
      await loadPantry();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  });
}

// Global functions called from inline onclick
window.deletePantryItem = async (id) => {
  if (!confirm("Remove this item from your pantry?")) return;
  try {
    await api.deletePantryItem(id);
    await loadPantry();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
};

window.editPantryItem = (id) => {
  const item = pantryItems.find((i) => i._id === id);
  if (!item) return;

  document.getElementById("edit-id").value = id;
  document.getElementById("edit-ingredient").value = item.ingredient;
  document.getElementById("edit-qty").value = item.quantity;
  document.getElementById("edit-unit").value = item.unit;
  document.getElementById("edit-expiry").value = item.expiration_date || "";

  document.getElementById("edit-modal").classList.remove("hidden");
};

window.lookupWiki = (ingredient) => {
  showWikiModal(ingredient);
};

export function setupEditModal() {
  const modal = document.getElementById("edit-modal");
  const closeBtn = document.getElementById("edit-close");
  const form = document.getElementById("edit-form");

  closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
  modal.querySelector(".modal-backdrop").addEventListener("click", () => modal.classList.add("hidden"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("edit-id").value;
    const ingredient = document.getElementById("edit-ingredient").value.trim();
    const quantity = document.getElementById("edit-qty").value;
    const unit = document.getElementById("edit-unit").value;
    const expiration_date = document.getElementById("edit-expiry").value.trim();

    try {
      await api.updatePantryItem(id, {
        ingredient,
        quantity,
        unit,
        expiration_date: expiration_date || null,
      });
      modal.classList.add("hidden");
      await loadPantry();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  });
}

export async function getPantryItems() {
  return pantryItems;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
