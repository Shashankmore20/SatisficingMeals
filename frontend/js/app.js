import { api } from "./api.js";
import { initAuth } from "./auth.js";
import { initPantry, setupEditModal } from "./pantry.js";
import { initRecipes, getTopRecipe } from "./recipes.js";
import { initShopping } from "./shopping.js";
import { setupWikiModal } from "./wikipedia.js";

let currentUser = null;

// ─── Boot ────────────────────────────────────────────────────────────────────

async function boot() {
  setupWikiModal();
  setupEditModal();
  setupLogout();

  try {
    currentUser = await api.getMe();
    showApp(currentUser);
  } catch {
    showAuth();
  }
}

// ─── Auth state ──────────────────────────────────────────────────────────────

function showAuth() {
  document.getElementById("auth-container").classList.remove("hidden");
  document.getElementById("app-container").classList.add("hidden");
  initAuth(onLogin);
}

function showApp(user) {
  document.getElementById("auth-container").classList.add("hidden");
  document.getElementById("app-container").classList.remove("hidden");
  document.getElementById("nav-username").textContent = user.name || user.username;
  initApp(user);
}

async function onLogin(user) {
  currentUser = user;
  showApp(user);
}

function setupLogout() {
  document.getElementById("logout-btn").addEventListener("click", async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    currentUser = null;
    showAuth();
  });
}

// ─── App init ────────────────────────────────────────────────────────────────

async function initApp(user) {
  setupNavigation();
  await navigateTo("dashboard");
  setGreeting(user.name || user.username);
  await loadDashboard();
}

function setGreeting(name) {
  const hour = new Date().getHours();
  let time = "evening";
  if (hour < 12) time = "morning";
  else if (hour < 17) time = "afternoon";

  document.getElementById("greeting-time").textContent = time;
  document.getElementById("greeting-name").textContent = name.split(" ")[0];
}

async function loadDashboard() {
  // Load expiring items
  try {
    const expiring = await api.getExpiring();
    const list = document.getElementById("expiring-list");
    const badge = document.getElementById("expiring-count");
    badge.textContent = expiring.length;

    if (expiring.length === 0) {
      list.innerHTML = `<p class="empty-state small">Nothing expiring soon — nice!</p>`;
    } else {
      list.innerHTML = expiring
        .map((item) => {
          const now = new Date();
          const exp = new Date(item.expiration_date);
          const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
          const urgency = daysLeft <= 3 ? "urgent" : "soon";
          return `
          <div class="expiring-item ${urgency}">
            <span>${capitalize(item.ingredient)}</span>
            <span class="days-left">${daysLeft}d left</span>
          </div>
        `;
        })
        .join("");
    }
  } catch (err) {
    console.error("Dashboard expiring error:", err);
  }

  // Load top recipe
  try {
    const top = await getTopRecipe();
    const recipeEl = document.getElementById("top-recipe");
    if (top && top.score > 0) {
      recipeEl.innerHTML = `
        <div class="top-recipe-content">
          <h4>${top.name}</h4>
          <p>${top.Description}</p>
          <span class="recipe-time-badge">⏱ ${top.Time_to_make_hours}h</span>
          ${top.usesExpiring ? `<span class="expiring-badge small">Uses expiring items!</span>` : ""}
        </div>
      `;
    } else {
      recipeEl.innerHTML = `<p class="empty-state small">Add pantry items to get recipe suggestions.</p>`;
    }
  } catch (err) {
    console.error("Dashboard recipe error:", err);
  }

  // Load purchase history
  try {
    const history = await api.getPurchaseHistory();
    const historyEl = document.getElementById("top-purchases");

    if (history.length === 0) {
      historyEl.innerHTML = `<p class="empty-state small">No purchase history yet.</p>`;
    } else {
      historyEl.innerHTML = history
        .slice(0, 5)
        .map(
          (item) => `
        <div class="purchase-item">
          <span class="purchase-name">${capitalize(item._id)}</span>
          <span class="purchase-count">×${item.count}</span>
        </div>
      `
        )
        .join("");
    }
  } catch (err) {
    console.error("Dashboard history error:", err);
  }
}

// ─── Navigation ──────────────────────────────────────────────────────────────

let pageModulesLoaded = {};

async function navigateTo(pageName) {
  // Update nav buttons
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === pageName);
  });

  // Show/hide pages
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("hidden", page.id !== `page-${pageName}`);
    page.classList.toggle("active", page.id === `page-${pageName}`);
  });

  // Initialize page module once
  if (!pageModulesLoaded[pageName]) {
    pageModulesLoaded[pageName] = true;
    if (pageName === "pantry") await initPantry();
    if (pageName === "recipes") await initRecipes();
    if (pageName === "shopping") await initShopping();
  }
}

function setupNavigation() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => navigateTo(btn.dataset.page));
  });
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Start the app
boot();
