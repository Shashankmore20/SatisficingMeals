import { api } from "./api.js";

export async function initRecipes() {
  await loadRecipeSuggestions();
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
  const scoreColor = scorePercent >= 75 ? "score-high" : scorePercent >= 40 ? "score-mid" : "score-low";

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
      ${
        recipe.missing.length > 0
          ? `<button class="btn btn-outline btn-sm" onclick="window.addMissingToList('${recipe.name}', ${JSON.stringify(recipe.missing).replace(/"/g, "&quot;")})">
          Add missing to shopping list
        </button>`
          : `<span class="can-make-badge">✨ You can make this now!</span>`
      }
      ${
        recipe.prep_required
          ? `<button class="btn btn-ghost btn-sm" onclick="window.showPrepInstructions('${recipe.name}')">
          View prep instructions
        </button>`
          : ""
      }
    </div>
  `;
}

window.addMissingToList = async (recipeName, missing) => {
  const listName = prompt(`Create a new shopping list for "${recipeName}"?`, `${recipeName} ingredients`);
  if (!listName) return;

  try {
    await api.createShoppingList({
      name: listName,
      items: missing.map((ing) => ({ ingredient: ing, quantity: 1, unit: "item" })),
    });
    alert(`Shopping list "${listName}" created!`);
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
};

window.showPrepInstructions = async (recipeName) => {
  try {
    const prep = await api.getRecipePrep(recipeName);
    if (prep.length === 0) {
      alert(`No specific prep instructions found for ${recipeName}.`);
      return;
    }

    const instructions = prep
      .map((p) => `• ${p.Instruction} (${p.hours_ahead} hours ahead)`)
      .join("\n");

    alert(`Prep instructions for ${recipeName}:\n\n${instructions}`);
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
};

export async function getTopRecipe() {
  try {
    const recipes = await api.getRecipeSuggestions();
    return recipes.find((r) => r.score > 0) || null;
  } catch {
    return null;
  }
}
