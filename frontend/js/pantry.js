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
        <div class="pantry-item-img-wrap">
          <img class="pantry-item-img" src="" alt="${capitalize(item.ingredient)}"
            data-query="${item.ingredient}"
            onerror="this.parentElement.style.display='none'" />
          <div class="pantry-item-img-skeleton"></div>
        </div>
        <div class="pantry-item-body">
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
      </div>
    `;
    })
    .join("");

  // Load images lazily after render
  loadPantryImages();
}

// ── Image cache using localStorage ────────────────────────────────
const IMAGE_CACHE_KEY = "sm_image_cache";

function getImageCache() {
  try {
    return JSON.parse(localStorage.getItem(IMAGE_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function setImageCache(cache) {
  try {
    localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* localStorage full */
  }
}

function getCachedImage(ingredient) {
  return getImageCache()[ingredient.toLowerCase()] || null;
}

function setCachedImage(ingredient, url) {
  const cache = getImageCache();
  cache[ingredient.toLowerCase()] = url;
  setImageCache(cache);
}

export async function prefetchPantryImages(items) {
  const cache = getImageCache();
  const missing = items.filter((item) => !cache[item.ingredient.toLowerCase()]);
  for (const item of missing) {
    try {
      const data = await api.getImage(item.ingredient);
      setCachedImage(item.ingredient, data.thumb);
    } catch {
      /* skip */
    }
  }
}

async function loadPantryImages() {
  const imgs = document.querySelectorAll(".pantry-item-img[data-query]");
  for (const img of imgs) {
    const query = img.dataset.query;
    const skeleton = img.parentElement.querySelector(
      ".pantry-item-img-skeleton",
    );

    const applyImage = (url) => {
      const showImage = () => {
        skeleton.style.display = "none";
        img.style.opacity = "1";
      };
      img.onload = showImage;
      img.onerror = () => {
        img.parentElement.style.display = "none";
      };
      img.src = url;
      // For already-cached browser images, onload won't fire
      // Use a short timeout to check if it loaded
      setTimeout(() => {
        if (img.naturalWidth > 0) showImage();
      }, 100);
    };

    // Check localStorage cache first — no API call needed
    const cached = getCachedImage(query);
    if (cached) {
      applyImage(cached);
      continue;
    }

    // Not in cache yet — fetch and store
    try {
      const data = await api.getImage(query);
      setCachedImage(query, data.thumb);
      applyImage(data.thumb);
    } catch {
      img.parentElement.style.display = "none";
    }
  }
}

function setupFilters() {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
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
  const dropdown = document.getElementById("ingredient-dropdown");

  addBtn.addEventListener("click", () => {
    formContainer.classList.remove("hidden");
    ingredientInput.focus();
  });

  cancelBtn.addEventListener("click", () => {
    formContainer.classList.add("hidden");
    form.reset();
    dropdown.classList.add("hidden");
  });

  // ── Autocomplete ──
  let debounceTimer;
  let selectedFromDropdown = false;

  ingredientInput.addEventListener("input", () => {
    selectedFromDropdown = false;
    clearTimeout(debounceTimer);
    const val = ingredientInput.value.trim();

    if (val.length < 1) {
      dropdown.classList.add("hidden");
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const results = await api.searchIngredients(val);
        if (results.length === 0) {
          dropdown.classList.add("hidden");
          return;
        }

        dropdown.innerHTML = results
          .map(
            (ing) =>
              `<li class="ingredient-option" data-value="${ing}">
                ${capitalize(ing)}
                ${ing.toLowerCase() === val.toLowerCase() ? "" : `<span class="ing-match">${highlightMatch(ing, val)}</span>`}
              </li>`,
          )
          .join("");

        dropdown.classList.remove("hidden");

        dropdown.querySelectorAll(".ingredient-option").forEach((li) => {
          li.addEventListener("mousedown", async (e) => {
            e.preventDefault();
            const chosen = li.dataset.value;
            ingredientInput.value = chosen;
            selectedFromDropdown = true;
            dropdown.classList.add("hidden");

            // Auto-fill expiry: 2 weeks from today
            if (!expiryInput.value) {
              expiryInput.value = twoWeeksFromToday();
            }
          });
        });
      } catch {
        dropdown.classList.add("hidden");
      }
    }, 250);
  });

  // Hide dropdown on blur, auto-fill expiry if still empty
  ingredientInput.addEventListener("blur", () => {
    setTimeout(() => dropdown.classList.add("hidden"), 150);
    const val = ingredientInput.value.trim();
    if (val && !expiryInput.value) {
      expiryInput.value = twoWeeksFromToday();
    }
  });

  // ── Submit ──
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    dropdown.classList.add("hidden");

    const ingredient = ingredientInput.value.trim();
    const quantity = document.getElementById("pantry-qty").value;
    const unit = document.getElementById("pantry-unit").value;
    const expiration_date = expiryInput.value.trim();

    try {
      // If user typed something not selected from dropdown, add it to DB silently
      if (!selectedFromDropdown) {
        await api.addIngredient({
          ingredient,
          expiration_date: expiration_date || null,
        });
      }

      await api.addPantryItem({
        ingredient,
        quantity,
        unit,
        expiration_date: expiration_date || null,
      });
      form.reset();
      formContainer.classList.add("hidden");
      selectedFromDropdown = false;
      await loadPantry();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  });
}

function twoWeeksFromToday() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const yr = String(d.getFullYear()).slice(-2);
  return `${m}/${day}/${yr}`;
}

function highlightMatch(ingredient, query) {
  const idx = ingredient.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return "";
  return `…${ingredient.slice(Math.max(0, idx - 2), idx)}<strong>${ingredient.slice(idx, idx + query.length)}</strong>${ingredient.slice(idx + query.length, idx + query.length + 6)}`;
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
  modal
    .querySelector(".modal-backdrop")
    .addEventListener("click", () => modal.classList.add("hidden"));

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
