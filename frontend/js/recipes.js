import { api } from "./api.js";

export async function initRecipes() {
  await loadRecipeSuggestions();
  setupRecipeListeners();
}

async function loadRecipeSuggestions() {
  const container = document.getElementById("recipes-list");
  container.innerHTML = `<p class="empty-state">Loading recipes...</p>`;

  try {
    const recipes = await api.getRecipeSuggestions();

    if (recipes.length === 0) {
      container.innerHTML = `<p class="empty-state">No recipes found. Add ingredients to your pantry to get suggestions!</p>`;
      return;
    }

    container.innerHTML = recipes.map((r) => renderRecipeCard(r)).join("");
  } catch (err) {
    container.innerHTML = `<p class="empty-state">Failed to load recipes.</p>`;
    console.error(err);
  }
}

function renderRecipeCard(recipe) {
  const scorePercent = Math.round(recipe.score * 100);
  const scoreColor =
    scorePercent >= 75
      ? "score-high"
      : scorePercent >= 40
        ? "score-mid"
        : "score-low";

  // Safely encode recipe name for data attributes
  const safeName = encodeURIComponent(recipe.name);
  const missingJson = encodeURIComponent(JSON.stringify(recipe.missing));

  return `
    <div class="recipe-card ${recipe.usesExpiring ? "uses-expiring" : ""}">
      ${recipe.usesExpiring ? `<div class="expiring-badge">Uses expiring ingredients!</div>` : ""}

      <div class="recipe-header">
        <h3 class="recipe-name">${recipe.name}</h3>
        <div class="recipe-score ${scoreColor}">
          <span class="score-num">${scorePercent}%</span>
          <span class="score-label">match</span>
        </div>
      </div>

      <p class="recipe-desc">${recipe.Description}</p>

      <div class="recipe-meta">
        <span class="recipe-time">⏱ ${recipe.Time_to_make_hours}h</span>
        ${recipe.prep_required ? `<span class="recipe-prep-badge">🌙 Prep ahead</span>` : ""}
      </div>

      <div class="recipe-ingredients">
        <div class="ingredients-have">
          <span class="ing-label">✅ Have (${recipe.have.length})</span>
          <span class="ing-list">${recipe.have.join(", ") || "—"}</span>
        </div>
        ${
          recipe.missing.length > 0
            ? `<div class="ingredients-missing">
                <span class="ing-label">🛒 Need (${recipe.missing.length})</span>
                <span class="ing-list">${recipe.missing.join(", ")}</span>
               </div>`
            : ""
        }
      </div>

      <div class="recipe-actions">
        ${
          recipe.missing.length > 0
            ? `<button class="btn btn-outline btn-sm" data-action="add-missing" data-recipe="${safeName}" data-missing="${missingJson}">
                Add missing to shopping list
               </button>`
            : `<span class="can-make-badge">✨ You can make this now!</span>`
        }
        ${
          recipe.prep_required
            ? `<button class="btn btn-ghost btn-sm" data-action="show-prep" data-recipe="${safeName}">
                🌙 View prep instructions
               </button>`
            : ""
        }
        <button class="btn btn-ghost btn-sm" data-action="show-instructions" data-recipe="${safeName}">
          📋 View cooking instructions
        </button>
      </div>
    </div>
  `;
}

// ── Event delegation — one listener on the container ──────────────────────
function setupRecipeListeners() {
  const container = document.getElementById("recipes-list");

  container.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    const recipeName = decodeURIComponent(btn.dataset.recipe || "");

    if (action === "add-missing") {
      const missing = JSON.parse(
        decodeURIComponent(btn.dataset.missing || "[]"),
      );
      await handleAddMissing(recipeName, missing);
    } else if (action === "show-prep") {
      await showPrepModal(recipeName);
    } else if (action === "show-instructions") {
      await showInstructionsModal(recipeName);
    }
  });
}

// ── Add missing to shopping list ───────────────────────────────────────────
async function handleAddMissing(recipeName, missing) {
  // Use a proper modal instead of prompt — reuse the instructions modal
  const modal = document.getElementById("instructions-modal");
  const contentEl = document.getElementById("instructions-modal-content");

  contentEl.innerHTML = `
    <h3 class="prep-modal-title">🛒 Add to Shopping List</h3>
    <p class="prep-modal-recipe">${recipeName}</p>
    <p style="font-size:0.9rem; color:var(--ink-muted); margin-bottom:16px;">
      These ingredients will be added to a new shopping list:
    </p>
    <ul class="missing-items-list">
      ${missing.map((ing) => `<li>${capitalize(ing)}</li>`).join("")}
    </ul>
    <div class="form-group" style="margin-top:16px;">
      <label>List name</label>
      <input type="text" id="new-list-name-input" class="missing-list-name"
        value="${recipeName} ingredients" />
    </div>
    <div class="form-actions" style="margin-top:16px;">
      <button class="btn btn-primary" id="confirm-add-missing">Create List</button>
      <button class="btn btn-ghost" id="cancel-add-missing">Cancel</button>
    </div>
  `;
  modal.classList.remove("hidden");

  document
    .getElementById("cancel-add-missing")
    .addEventListener("click", () => {
      modal.classList.add("hidden");
    });

  document
    .getElementById("confirm-add-missing")
    .addEventListener("click", async () => {
      const listName = document
        .getElementById("new-list-name-input")
        .value.trim();
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
        contentEl.innerHTML = `
        <div style="text-align:center; padding:32px 0;">
          <div style="font-size:2.5rem; margin-bottom:12px;">✅</div>
          <h3>Shopping list created!</h3>
          <p style="color:var(--ink-muted); margin-top:8px;">"${listName}" is ready in your shopping lists.</p>
        </div>
      `;
        setTimeout(() => modal.classList.add("hidden"), 1800);
      } catch (err) {
        alert(`Error: ${err.message}`);
      }
    });
}

// ── Prep instructions modal ────────────────────────────────────────────────
async function showPrepModal(recipeName) {
  const modal = document.getElementById("prep-modal");
  const contentEl = document.getElementById("prep-modal-content");

  contentEl.innerHTML = `
    <h3 class="prep-modal-title">🌙 Prep Instructions</h3>
    <p class="prep-modal-recipe">${recipeName}</p>
    <p class="prep-loading">Loading...</p>
  `;
  modal.classList.remove("hidden");

  try {
    const prep = await api.getRecipePrep(recipeName);

    if (prep.length === 0) {
      contentEl.innerHTML = `
        <h3 class="prep-modal-title">🌙 Prep Instructions</h3>
        <p class="prep-modal-recipe">${recipeName}</p>
        <p class="prep-empty">No specific prep instructions for this recipe.</p>
      `;
      return;
    }

    contentEl.innerHTML = `
      <h3 class="prep-modal-title">🌙 Prep Instructions</h3>
      <p class="prep-modal-recipe">${recipeName}</p>
      <div class="prep-steps">
        ${prep
          .map(
            (p) => `
          <div class="prep-step">
            <div class="prep-step-time">
              <span class="prep-hours">${p.hours_ahead}h</span>
              <span class="prep-ahead">ahead</span>
            </div>
            <div class="prep-step-text">${p.Instruction}</div>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  } catch (_err) {
    contentEl.innerHTML = `
      <h3 class="prep-modal-title">🌙 Prep Instructions</h3>
      <p class="prep-error">Failed to load prep instructions.</p>
    `;
  }
}

// ── Cooking instructions modal ─────────────────────────────────────────────
async function showInstructionsModal(recipeName) {
  const modal = document.getElementById("instructions-modal");
  const contentEl = document.getElementById("instructions-modal-content");

  contentEl.innerHTML = `
    <h3 class="prep-modal-title">📋 Cooking Instructions</h3>
    <p class="prep-modal-recipe">${recipeName}</p>
    <p class="prep-loading">Loading...</p>
  `;
  modal.classList.remove("hidden");

  try {
    const recipes = await api.getRecipes();
    const recipe = recipes.find(
      (r) =>
        r.name.toLowerCase() === decodeURIComponent(recipeName).toLowerCase(),
    );

    // Support both 'Instructions' (capital) and 'instructions' (lowercase)
    const instructionData = recipe.Instructions || recipe.instructions;

    if (!recipe || !instructionData) {
      contentEl.innerHTML = `
        <h3 class="prep-modal-title">📋 Cooking Instructions</h3>
        <p class="prep-modal-recipe">${recipeName}</p>
        <p class="prep-empty">No cooking instructions added yet for this recipe.</p>
      `;
      return;
    }

    // Instructions can be a string or an array of steps
    const steps = Array.isArray(instructionData)
      ? instructionData
      : instructionData.split(/\n+/).filter(Boolean);

    contentEl.innerHTML = `
      <h3 class="prep-modal-title">📋 Cooking Instructions</h3>
      <p class="prep-modal-recipe">${recipe.name}</p>
      <div class="recipe-meta" style="margin-bottom:16px;">
        <span class="rotd-pill">⏱ ${recipe.Time_to_make_hours}h total</span>
        ${recipe.prep_required ? `<span class="rotd-pill prep">🌙 Needs advance prep</span>` : ""}
      </div>
      <div class="cooking-steps">
        ${steps
          .map(
            (step, i) => `
          <div class="cooking-step">
            <div class="cooking-step-num">${i + 1}</div>
            <div class="cooking-step-text">${step}</div>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  } catch (_err) {
    contentEl.innerHTML = `
      <h3 class="prep-modal-title">📋 Cooking Instructions</h3>
      <p class="prep-error">Failed to load cooking instructions.</p>
    `;
  }
}

// ── Modal setup ────────────────────────────────────────────────────────────
export function setupPrepModal() {
  const prepModal = document.getElementById("prep-modal");
  document
    .getElementById("prep-close")
    .addEventListener("click", () => prepModal.classList.add("hidden"));
  prepModal
    .querySelector(".modal-backdrop")
    .addEventListener("click", () => prepModal.classList.add("hidden"));

  const instrModal = document.getElementById("instructions-modal");
  document
    .getElementById("instructions-close")
    .addEventListener("click", () => instrModal.classList.add("hidden"));
  instrModal
    .querySelector(".modal-backdrop")
    .addEventListener("click", () => instrModal.classList.add("hidden"));
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}
