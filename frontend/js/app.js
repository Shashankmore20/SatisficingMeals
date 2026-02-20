import { api } from "./api.js";
import { initAuth } from "./auth.js";
import { initPantry, setupEditModal, prefetchPantryImages } from "./pantry.js";
import { initRecipes, setupPrepModal } from "./recipes.js";
import { initShopping } from "./shopping.js";
import { setupWikiModal } from "./wikipedia.js";

let currentUser = null;

async function boot() {
  setupWikiModal();
  setupPrepModal();
  setupEditModal();
  setupLogout();
  try {
    currentUser = await api.getMe();
    showApp(currentUser);
  } catch {
    showAuth();
  }
}

function showAuth() {
  document.getElementById("auth-container").classList.remove("hidden");
  document.getElementById("app-container").classList.add("hidden");
  initAuth(onLogin);
}

function showApp(user) {
  document.getElementById("auth-container").classList.add("hidden");
  document.getElementById("app-container").classList.remove("hidden");
  document.getElementById("nav-username").textContent =
    user.name || user.username;
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
      /* ignore */
    }
    currentUser = null;
    showAuth();
  });
}

async function initApp(user) {
  setupNavigation();
  await navigateTo("dashboard");
  setGreeting(user.name || user.username);

  // Pre-fetch pantry images into localStorage so cards load instantly
  try {
    const pantryItems = await api.getPantry();
    prefetchPantryImages(pantryItems);
  } catch {
    /* non-critical */
  }

  await loadDashboard(user);
}

function setGreeting(name) {
  const hour = new Date().getHours();
  let time = "evening";
  if (hour < 12) time = "morning";
  else if (hour < 17) time = "afternoon";
  document.getElementById("greeting-time").textContent = time;
  document.getElementById("greeting-name").textContent = name.split(" ")[0];
}

async function loadDashboard(user) {
  // Goal card
  const goalCard = document.getElementById("user-goal-card");
  const goalEl = document.getElementById("user-goal-text");
  if (goalEl && user?.goal) {
    goalEl.textContent = user.goal;
    goalCard.classList.remove("hidden");
  }

  // Expiring items
  try {
    const expiring = await api.getExpiring();
    const list = document.getElementById("expiring-list");
    const badge = document.getElementById("expiring-count");
    badge.textContent = expiring.length;
    if (expiring.length === 0) {
      list.innerHTML = `<p class="empty-state small">Nothing expiring soon — nice! 🎉</p>`;
    } else {
      list.innerHTML = expiring
        .map((item) => {
          const daysLeft = Math.ceil(
            (new Date(item.expiration_date) - new Date()) /
              (1000 * 60 * 60 * 24),
          );
          const urgency = daysLeft <= 3 ? "urgent" : "soon";
          return `<div class="expiring-item ${urgency}">
          <span>${capitalize(item.ingredient)}</span>
          <span class="days-left">${daysLeft}d left</span>
        </div>`;
        })
        .join("");
    }
  } catch (err) {
    console.error("Dashboard expiring error:", err);
  }

  // Recipes of the day - 3 random
  try {
    const daily = await api.getDailyRecipes();
    const recipeEl = document.getElementById("recipe-of-day");
    if (daily && daily.length > 0) {
      recipeEl.innerHTML = `<div class="rotd-grid">${daily
        .map(
          (r) => `
        <div class="rotd-card-item">
          <div class="rotd-img-wrap">
            <img class="rotd-img" src="" alt="${capitalize(r.name)}" data-recipe="${encodeURIComponent(r.name)}" />
            <div class="rotd-img-skeleton"></div>
          </div>
          <div class="rotd-card-top">
            <h3 class="rotd-name">${capitalize(r.name)}</h3>
            <div class="rotd-meta">
              <span class="rotd-pill">⏱ ${r.Time_to_make_hours}h</span>
              ${r.prep_required ? `<span class="rotd-pill prep">🌙 Prep ahead</span>` : ""}
            </div>
          </div>
          <p class="rotd-desc">${r.Description}</p>
          <div class="rotd-ingredients">
            <span class="rotd-ing-label">Ingredients:</span>
            <span class="rotd-ing-list">${r.Ingredients.slice(0, 5).join(", ")}${r.Ingredients.length > 5 ? ` +${r.Ingredients.length - 5} more` : ""}</span>
          </div>
        </div>`,
        )
        .join("")}</div>`;
      loadDashboardRecipeImages();
    } else {
      recipeEl.innerHTML = `<p class="empty-state small">No recipes found in database.</p>`;
    }
  } catch (err) {
    console.error("Dashboard recipe error:", err);
  }

  // Purchase history
  try {
    const history = await api.getPurchaseHistory();
    const historyEl = document.getElementById("top-purchases");
    if (history.length === 0) {
      historyEl.innerHTML = `<p class="empty-state small">No purchase history yet.</p>`;
    } else {
      historyEl.innerHTML = history
        .slice(0, 5)
        .map(
          (item, i) => `
        <div class="purchase-item">
          <span class="purchase-rank">${i + 1}</span>
          <span class="purchase-name">${capitalize(item._id)}</span>
          <span class="purchase-count">×${item.count}</span>
        </div>`,
        )
        .join("");
    }
  } catch (err) {
    console.error("Dashboard history error:", err);
  }
}

function loadDashboardRecipeImages() {
  const RECIPE_IMAGE_CACHE_KEY = "sm_recipe_image_cache";
  let cache = {};
  try {
    cache = JSON.parse(localStorage.getItem(RECIPE_IMAGE_CACHE_KEY) || "{}");
  } catch {
    /* */
  }

  const imgs = document.querySelectorAll(".rotd-img[data-recipe]");
  imgs.forEach(async (img) => {
    const name = decodeURIComponent(img.dataset.recipe);
    const skeleton = img.parentElement.querySelector(".rotd-img-skeleton");

    const applyImage = (url) => {
      img.src = url;
      skeleton.style.display = "none";
      img.style.opacity = "1";
    };

    const cached = cache[name.toLowerCase()];
    if (cached) {
      applyImage(cached);
    } else {
      try {
        const data = await api.getImage(name);
        cache[name.toLowerCase()] = data.url;
        localStorage.setItem(RECIPE_IMAGE_CACHE_KEY, JSON.stringify(cache));
        applyImage(data.url);
      } catch {
        img.parentElement.style.display = "none";
      }
    }
  });
}

let pageModulesLoaded = {};

async function navigateTo(pageName) {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === pageName);
  });
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("hidden", page.id !== `page-${pageName}`);
    page.classList.toggle("active", page.id === `page-${pageName}`);
  });
  if (!pageModulesLoaded[pageName]) {
    pageModulesLoaded[pageName] = true;
    if (pageName === "pantry") await initPantry();
    if (pageName === "recipes") await initRecipes();
    if (pageName === "shopping") await initShopping();
  }
}

window.navigateTo = navigateTo;

function setupNavigation() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => navigateTo(btn.dataset.page));
  });
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

boot();
