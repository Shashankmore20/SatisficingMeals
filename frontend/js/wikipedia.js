import { api } from "./api.js";

export async function showWikiModal(ingredient) {
  const modal = document.getElementById("wiki-modal");
  const content = document.getElementById("wiki-content");

  content.innerHTML = `<div class="wiki-loading">Looking up "${ingredient}"...</div>`;
  modal.classList.remove("hidden");

  try {
    const data = await api.getWikipedia(ingredient);

    content.innerHTML = `
      <div class="wiki-article">
        ${data.thumbnail ? `<img src="${data.thumbnail}" alt="${data.title}" class="wiki-thumb" />` : ""}
        <div class="wiki-text">
          <h2 class="wiki-title">${data.title}</h2>
          ${data.description ? `<p class="wiki-description">${data.description}</p>` : ""}
          <p class="wiki-extract">${data.extract}</p>
          ${data.url ? `<a href="${data.url}" target="_blank" rel="noopener noreferrer" class="wiki-link">Read more on Wikipedia →</a>` : ""}
        </div>
      </div>
    `;
  } catch (_err) {
    content.innerHTML = `
      <div class="wiki-error">
        <p>No Wikipedia article found for "${ingredient}".</p>
      </div>
    `;
  }
}

export function setupWikiModal() {
  const modal = document.getElementById("wiki-modal");
  const closeBtn = document.getElementById("wiki-close");

  closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
  modal
    .querySelector(".modal-backdrop")
    .addEventListener("click", () => modal.classList.add("hidden"));
}
