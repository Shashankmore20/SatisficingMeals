import { api } from "./api.js";

let shoppingLists = [];

export async function initShopping() {
  await loadShoppingLists();
  setupNewListForm();
}

async function loadShoppingLists() {
  try {
    shoppingLists = await api.getShoppingLists();
    renderShoppingLists();
  } catch (err) {
    console.error("Failed to load shopping lists:", err);
  }
}

function renderShoppingLists() {
  const container = document.getElementById("shopping-lists");

  if (shoppingLists.length === 0) {
    container.innerHTML = `<p class="empty-state">No shopping lists yet. Create one!</p>`;
    return;
  }

  container.innerHTML = shoppingLists
    .map((list) => renderListCard(list))
    .join("");

  // Attach inline add-item forms to each card
  shoppingLists.forEach((list) => {
    attachAddItemForm(list._id);
  });
}

function renderListCard(list) {
  const total = list.items.length;
  const checked = list.items.filter((i) => i.checked).length;
  const sortedItems = [...list.items]
    .map((item, idx) => ({ ...item, originalIdx: idx }))
    .sort((a, b) => a.checked - b.checked);

  return `
    <div class="shopping-list-card" data-id="${list._id}">
      <div class="list-header">
        <div class="list-title-row">
          <h3 class="list-name">${list.name}</h3>
          <div class="list-header-actions">
            <span class="list-progress">${checked}/${total}</span>
            <button class="btn-icon btn-danger" title="Delete list" onclick="window.deleteList('${list._id}')">🗑️</button>
          </div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${total > 0 ? (checked / total) * 100 : 0}%"></div>
        </div>
      </div>

      <ul class="shopping-items">
        ${
          sortedItems.length === 0
            ? `<li class="shopping-empty">No items yet — add some below!</li>`
            : sortedItems
                .map(
                  (item) => `
          <li class="shopping-item ${item.checked ? "checked" : ""}">
            <label class="item-check-label">
              <input type="checkbox" class="item-checkbox"
                ${item.checked ? "checked" : ""}
                onchange="window.toggleItem('${list._id}', ${item.originalIdx})"
              />
              <span class="item-name">${capitalize(item.ingredient)}</span>
              <span class="item-qty">${item.quantity} ${item.unit}</span>
              <button class="btn-icon btn-danger item-delete" title="Remove item"
                onclick="window.removeShoppingItem('${list._id}', ${item.originalIdx})">✕</button>
            </label>
          </li>`,
                )
                .join("")
        }
      </ul>

      <!-- Inline add-item form (injected by JS) -->
      <div class="add-item-slot" data-list-id="${list._id}"></div>

      <div class="list-footer">
        <button class="btn btn-sm btn-outline" id="show-add-${list._id}">
          + Add Item
        </button>
        ${
          checked > 0
            ? `
          <button class="btn btn-sm btn-primary" onclick="window.moveListToPantry('${list._id}')">
            Move checked to pantry
          </button>`
            : ""
        }
      </div>
    </div>
  `;
}

function attachAddItemForm(listId) {
  const slot = document.querySelector(
    `.add-item-slot[data-list-id="${listId}"]`,
  );
  const showBtn = document.getElementById(`show-add-${listId}`);
  if (!slot || !showBtn) return;

  // Clone the template
  const template = document.getElementById("add-item-form-template");
  const form = template.content.cloneNode(true).querySelector(".add-item-form");
  slot.appendChild(form);

  const ingredientInput = form.querySelector(".add-item-ingredient");
  const qtyInput = form.querySelector(".add-item-qty");
  const unitSelect = form.querySelector(".add-item-unit");
  const submitBtn = form.querySelector(".add-item-submit");
  const cancelBtn = form.querySelector(".add-item-cancel");
  const dropdown = form.querySelector(".ingredient-dropdown");

  // Show form
  showBtn.addEventListener("click", () => {
    form.classList.remove("hidden");
    showBtn.classList.add("hidden");
    ingredientInput.focus();
  });

  // Cancel
  cancelBtn.addEventListener("click", () => {
    form.classList.add("hidden");
    showBtn.classList.remove("hidden");
    ingredientInput.value = "";
    qtyInput.value = "1";
    unitSelect.value = "item";
    dropdown.classList.add("hidden");
  });

  // Autocomplete
  let debounceTimer;
  ingredientInput.addEventListener("input", () => {
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
              `<li class="ingredient-option" data-value="${ing}">${capitalize(ing)}</li>`,
          )
          .join("");
        dropdown.classList.remove("hidden");

        dropdown.querySelectorAll(".ingredient-option").forEach((li) => {
          li.addEventListener("mousedown", (e) => {
            e.preventDefault();
            ingredientInput.value = li.dataset.value;
            dropdown.classList.add("hidden");
          });
        });
      } catch {
        dropdown.classList.add("hidden");
      }
    }, 250);
  });

  ingredientInput.addEventListener("blur", () => {
    setTimeout(() => dropdown.classList.add("hidden"), 150);
  });

  // Submit
  submitBtn.addEventListener("click", async () => {
    const ingredient = ingredientInput.value.trim();
    if (!ingredient) {
      ingredientInput.focus();
      return;
    }

    const quantity = parseFloat(qtyInput.value) || 1;
    const unit = unitSelect.value;

    const list = shoppingLists.find((l) => l._id === listId);
    if (!list) return;

    const updatedItems = [
      ...list.items,
      { ingredient: ingredient.toLowerCase(), quantity, unit, checked: false },
    ];

    try {
      await api.updateShoppingList(listId, { items: updatedItems });
      // Reset form
      ingredientInput.value = "";
      qtyInput.value = "1";
      unitSelect.value = "item";
      await loadShoppingLists();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  });

  // Submit on Enter in ingredient field
  ingredientInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitBtn.click();
    }
  });
}

function setupNewListForm() {
  const newBtn = document.getElementById("new-list-btn");
  const cancelBtn = document.getElementById("cancel-list");
  const formContainer = document.getElementById("shopping-form-container");
  const form = document.getElementById("shopping-form");

  newBtn.addEventListener("click", () => {
    formContainer.classList.remove("hidden");
    document.getElementById("list-name").focus();
  });

  cancelBtn.addEventListener("click", () => {
    formContainer.classList.add("hidden");
    form.reset();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("list-name").value.trim();
    try {
      await api.createShoppingList({ name, items: [] });
      form.reset();
      formContainer.classList.add("hidden");
      await loadShoppingLists();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  });
}

// Global handlers
window.toggleItem = async (listId, itemIdx) => {
  try {
    await api.toggleShoppingItem(listId, itemIdx);
    await loadShoppingLists();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
};

window.removeShoppingItem = async (listId, itemIdx) => {
  const list = shoppingLists.find((l) => l._id === listId);
  if (!list) return;
  const updatedItems = list.items.filter((_, i) => i !== itemIdx);
  try {
    await api.updateShoppingList(listId, { items: updatedItems });
    await loadShoppingLists();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
};

window.moveListToPantry = async (listId) => {
  try {
    const result = await api.moveToPantry(listId);
    alert(result.message);
    await loadShoppingLists();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
};

window.deleteList = async (listId) => {
  if (!confirm("Delete this shopping list?")) return;
  try {
    await api.deleteShoppingList(listId);
    await loadShoppingLists();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
};

window.addMissingToList = async (recipeName, missing) => {
  const listName = prompt(
    `Create shopping list for "${recipeName}"?`,
    `${recipeName} ingredients`,
  );
  if (!listName) return;
  try {
    await api.createShoppingList({
      name: listName,
      items: missing.map((ing) => ({
        ingredient: ing,
        quantity: 1,
        unit: "item",
      })),
    });
    alert(`Shopping list "${listName}" created!`);
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
};

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
