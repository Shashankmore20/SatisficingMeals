import { api } from "./api.js";

let shoppingLists = [];

export async function initShopping() {
  await loadShoppingLists();
  setupShoppingForm();
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

  container.innerHTML = shoppingLists.map((list) => renderListCard(list)).join("");
}

function renderListCard(list) {
  const total = list.items.length;
  const checked = list.items.filter((i) => i.checked).length;

  // Sort: unchecked first
  const sortedItems = [...list.items]
    .map((item, idx) => ({ ...item, originalIdx: idx }))
    .sort((a, b) => a.checked - b.checked);

  return `
    <div class="shopping-list-card" data-id="${list._id}">
      <div class="list-header">
        <div class="list-title-row">
          <h3 class="list-name">${list.name}</h3>
          <span class="list-progress">${checked}/${total}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${total > 0 ? (checked / total) * 100 : 0}%"></div>
        </div>
      </div>
      <ul class="shopping-items">
        ${sortedItems
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
            </label>
          </li>
        `
          )
          .join("")}
      </ul>
      <div class="list-footer">
        <div class="list-actions">
          <button class="btn btn-sm btn-outline" onclick="window.addItemToList('${list._id}')">
            + Add Item
          </button>
          ${
            checked > 0
              ? `<button class="btn btn-sm btn-primary" onclick="window.moveListToPantry('${list._id}')">
              Move checked to pantry
            </button>`
              : ""
          }
        </div>
        <button class="btn-icon btn-danger" title="Delete list" onclick="window.deleteList('${list._id}')">🗑️</button>
      </div>
    </div>
  `;
}

function setupShoppingForm() {
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

// Global handlers for inline events
window.toggleItem = async (listId, itemIdx) => {
  try {
    await api.toggleShoppingItem(listId, itemIdx);
    await loadShoppingLists();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
};

window.addItemToList = async (listId) => {
  const ingredient = prompt("Item name:");
  if (!ingredient) return;

  const quantityStr = prompt("Quantity:", "1");
  const quantity = parseFloat(quantityStr) || 1;
  const unit = prompt("Unit (item, g, kg, ml, L, cup, tbsp, tsp, oz, lb):", "item");

  const list = shoppingLists.find((l) => l._id === listId);
  if (!list) return;

  const updatedItems = [
    ...list.items,
    { ingredient: ingredient.toLowerCase(), quantity, unit: unit || "item", checked: false },
  ];

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

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
