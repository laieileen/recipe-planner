const THEMEALDB_URL = "https://www.themealdb.com/api/json/v1/1";
let currentRecipe = null;
let modalReturnFocus = null;

const $ = (selector) => document.querySelector(selector);
const pantryList = $("#pantryList");
const favoritesList = $("#favoritesList");
const resultsRail = $("#recipeResults");
const recipeModal = $("#recipeModal");

function readStorage(key, fallback = []) {
    try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch (error) {
        return fallback;
    }
}

function getPantry() { return readStorage("pantry"); }
function getFavorites() { return readStorage("favorites"); }
function getFavoriteId(favorite) { return favorite.id || favorite.idMeal || favorite.mealId; }
function setPantry(pantry) { localStorage.setItem("pantry", JSON.stringify(pantry)); renderPantry(); updateCounts(); }
function setFavorites(favorites) { localStorage.setItem("favorites", JSON.stringify(favorites)); renderFavorites(); updateCounts(); }

function escapeHTML(value = "") {
    return String(value).replace(/[&<>'"]/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[character]));
}

function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.innerHTML = `<div class="${type}">${escapeHTML(message)}</div>`;
    window.setTimeout(() => { element.innerHTML = ""; }, 3500);
}

function updateCounts(groceryCount = null) {
    const pantryCount = getPantry().length;
    const favoriteCount = getFavorites().length;
    ["pantryCount", "heroPantryCount", "navPantryCount"].forEach((id) => { const element = document.getElementById(id); if (element) element.textContent = pantryCount; });
    ["heroFavoritesCount", "navFavoritesCount"].forEach((id) => { const element = document.getElementById(id); if (element) element.textContent = favoriteCount; });
    if (groceryCount !== null) {
        $("#heroGroceryCount").textContent = groceryCount;
        $("#navGroceryCount").textContent = groceryCount;
    }
}

function renderPantry() {
    const pantry = getPantry();
    if (!pantry.length) {
        pantryList.innerHTML = '<div class="empty-state">Your pantry is waiting for its first few notes.</div>';
        return;
    }
    pantryList.innerHTML = pantry.map((ingredient) => `<div class="tag"><span>${escapeHTML(ingredient)}</span><button type="button" data-remove-ingredient="${escapeHTML(ingredient)}" aria-label="Remove ${escapeHTML(ingredient)}">×</button></div>`).join("");
}

function addIngredient() {
    const input = $("#ingredientInput");
    const ingredient = input.value.trim().toLowerCase();
    if (!ingredient) { showMessage("pantryMessage", "Write an ingredient first.", "error"); return; }
    const pantry = getPantry();
    if (pantry.includes(ingredient)) { showMessage("pantryMessage", "That ingredient is already here.", "error"); return; }
    pantry.push(ingredient);
    setPantry(pantry);
    input.value = "";
    showMessage("pantryMessage", `${ingredient} added to the pantry.`, "success");
}

function extractIngredients(recipe) {
    const ingredients = [];
    for (let index = 1; index <= 20; index += 1) {
        const ingredient = recipe[`strIngredient${index}`];
        if (ingredient && ingredient.trim()) ingredients.push(ingredient.trim());
    }
    return ingredients;
}

function recipeCard(recipe, saved = false) {
    const image = recipe.strMealThumb || recipe.image || "";
    const id = recipe.idMeal || recipe.id;
    const name = recipe.strMeal || recipe.name;
    return `<article class="recipe-card" data-recipe-id="${escapeHTML(id)}" data-recipe-name="${escapeHTML(name)}" data-recipe-image="${escapeHTML(image)}" tabindex="0" role="button" aria-label="View details for ${escapeHTML(name)}">
        ${image ? `<img class="recipe-photo" src="${escapeHTML(image)}" alt="${escapeHTML(name)}" loading="lazy">` : ""}
        <div class="recipe-card-copy"><div class="recipe-kicker">${saved ? "Saved for later" : "Recipe idea"}</div><h3>${escapeHTML(name)}</h3><p>${saved ? "Keep this one in rotation" : "Open the full recipe details"}</p>${saved ? `<div class="recipe-buttons"><button type="button" data-action="details">Details</button><button type="button" class="secondary" data-action="remove-favorite">Remove</button></div>` : `<div class="recipe-buttons"><button type="button" data-action="details">View recipe <span>↗</span></button></div>`}</div>
    </article>`;
}

function renderFavorites() {
    const favorites = getFavorites();
    favoritesList.classList.toggle("single-saved", favorites.length === 1);
    if (!favorites.length) {
        favoritesList.innerHTML = '<div class="empty-state">Save a recipe from discovery and it will live here, ready for its night.</div>';
        return;
    }
    favoritesList.innerHTML = favorites.map((favorite) => recipeCard(favorite, true)).join("");
}

async function searchRecipes(searchTerm = $("#searchInput").value.trim(), searchMode = $("#searchMode").value) {
    const input = searchTerm.trim();
    if (!input) { showMessage("searchMessage", searchMode === "name" ? "Search for a recipe name to begin." : "Search by an ingredient to begin.", "error"); return; }
    $("#searchInput").value = input;
    resultsRail.innerHTML = '<div class="loading">Finding something worth cooking...</div>';
    try {
        const endpoint = searchMode === "name" ? "search.php?s" : "filter.php?i";
        const response = await fetch(`${THEMEALDB_URL}/${endpoint}=${encodeURIComponent(input)}`);
        if (!response.ok) throw new Error("Search request failed");
        const data = await response.json();
        const recipes = (data.meals || []).slice(0, 12);
        if (!recipes.length) { resultsRail.innerHTML = `<div class="empty-state">Nothing came back for that ${searchMode === "name" ? "recipe name" : "ingredient"}. Try another search.</div>`; return; }
        resultsRail.innerHTML = recipes.map((recipe) => recipeCard(recipe)).join("");
    } catch (error) {
        resultsRail.innerHTML = '<div class="error">The kitchen could not reach the recipe service. Try again in a moment.</div>';
    }
}

async function viewRecipe(mealId, mealName, mealImage) {
    modalReturnFocus = document.activeElement;
    try {
        const response = await fetch(`${THEMEALDB_URL}/lookup.php?i=${encodeURIComponent(mealId)}`);
        if (!response.ok) throw new Error("Recipe request failed");
        const data = await response.json();
        const recipe = data.meals && data.meals[0];
        if (!recipe) throw new Error("Recipe not found");
        const ingredients = extractIngredients(recipe);
        const pantry = getPantry();
        const missing = ingredients.filter((ingredient) => !pantry.includes(ingredient.toLowerCase()));
        currentRecipe = { id: mealId, name: recipe.strMeal || mealName, image: mealImage || recipe.strMealThumb };
        $("#modalRecipeName").textContent = currentRecipe.name;
        $("#modalRecipeImage").src = currentRecipe.image;
        $("#modalRecipeImage").alt = currentRecipe.name;
        $("#modalIngredients").textContent = ingredients.join(", ");
        $("#modalInstructions").textContent = recipe.strInstructions || "Follow the recipe with your own rhythm.";
        $("#modalMissingStatus").innerHTML = missing.length ? `<span class="missing">Missing from pantry: ${escapeHTML(missing.join(", "))}</span>` : '<span class="have">Everything for this recipe is already in your pantry.</span>';
        $("#saveRecipeButton").textContent = getFavorites().some((favorite) => String(getFavoriteId(favorite)) === String(mealId)) ? "Already saved ✦" : "Save recipe ✦";
        recipeModal.hidden = false;
        document.body.style.overflow = "hidden";
        $("#closeModalButton").focus();
    } catch (error) {
        showMessage("searchMessage", "Could not load that recipe. Try again.", "error");
    }
}

function closeModal() {
    recipeModal.hidden = true;
    document.body.style.overflow = "";
    if (modalReturnFocus && typeof modalReturnFocus.focus === "function") modalReturnFocus.focus();
}

function saveCurrentRecipe() {
    if (!currentRecipe) return;
    const favorites = getFavorites();
    if (favorites.some((favorite) => String(getFavoriteId(favorite)) === String(currentRecipe.id))) { closeModal(); return; }
    favorites.push(currentRecipe);
    setFavorites(favorites);
    $("#saveRecipeButton").textContent = "Saved to your table ✦";
    showMessage("searchMessage", `${currentRecipe.name} saved to your table.`, "success");
}

async function buildGroceryList() {
    const favorites = getFavorites();
    const listDiv = $("#groceryList");
    if (!favorites.length) { listDiv.innerHTML = '<div class="empty-state">Save a recipe first, then your shopping list can take shape.</div>'; $("#groceryHeadline").textContent = "Ready when you are"; $("#grocerySubline").textContent = "Save a recipe to begin your list."; updateCounts(0); return; }
    listDiv.innerHTML = '<div class="loading">Gathering the missing pieces...</div>';
    const pantry = getPantry();
    const missingIngredients = new Set();
    let resolvedRecipes = 0;
    try {
        for (const favorite of favorites) {
            const favoriteId = getFavoriteId(favorite);
            if (!favoriteId) continue;
            const response = await fetch(`${THEMEALDB_URL}/lookup.php?i=${encodeURIComponent(favoriteId)}`);
            if (!response.ok) continue;
            const data = await response.json();
            const recipe = data.meals && data.meals[0];
            if (!recipe) continue;
            resolvedRecipes += 1;
            extractIngredients(recipe).forEach((ingredient) => { if (!pantry.includes(ingredient.toLowerCase())) missingIngredients.add(ingredient); });
        }
        if (!resolvedRecipes) throw new Error("No saved recipes could be loaded");
        const items = Array.from(missingIngredients).sort();
        updateCounts(items.length);
        $("#groceryHeadline").textContent = items.length ? `${items.length} things to gather` : "You are fully stocked";
        $("#grocerySubline").textContent = items.length ? "A short list for your saved recipes." : "Everything is ready for the recipes you saved.";
        listDiv.innerHTML = items.length ? `<div class="grocery-list"><ul>${items.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul></div>` : '<div class="empty-state"><span class="have">Every saved recipe is covered by your pantry.</span></div>';
    } catch (error) { listDiv.innerHTML = '<div class="error">Your saved recipes could not be loaded. Check your connection and try again.</div>'; }
}

function handleRecipeInteraction(event) {
    const card = event.target.closest(".recipe-card");
    if (!card) return;
    const action = event.target.closest("[data-action]")?.dataset.action;
    const id = card.dataset.recipeId;
    if (action === "remove-favorite") { setFavorites(getFavorites().filter((favorite) => String(getFavoriteId(favorite)) !== String(id))); return; }
    viewRecipe(id, card.dataset.recipeName, card.dataset.recipeImage);
}

function enableRailPointerEffects() {
    let pointerStart = null;
    let scrollStart = 0;
    resultsRail.addEventListener("pointerdown", (event) => { if (event.button !== 0) return; pointerStart = event.clientX; scrollStart = resultsRail.scrollLeft; });
    resultsRail.addEventListener("pointermove", (event) => {
        const card = event.target.closest(".recipe-card");
        if (card) { const bounds = card.getBoundingClientRect(); card.style.setProperty("--pointer-x", `${event.clientX - bounds.left}px`); card.style.setProperty("--pointer-y", `${event.clientY - bounds.top}px`); if (event.buttons) { const x = (event.clientX - bounds.left) / bounds.width - .5; const y = (event.clientY - bounds.top) / bounds.height - .5; card.style.transform = `perspective(700px) rotateY(${x * 4}deg) rotateX(${y * -4}deg) translateY(-3px)`; } }
        if (pointerStart !== null && event.buttons) resultsRail.scrollLeft = scrollStart - (event.clientX - pointerStart);
    });
    resultsRail.addEventListener("pointerup", () => { pointerStart = null; resultsRail.querySelectorAll(".recipe-card").forEach((card) => { card.style.transform = ""; }); });
    resultsRail.addEventListener("pointerleave", () => { pointerStart = null; resultsRail.querySelectorAll(".recipe-card").forEach((card) => { card.style.transform = ""; }); });
}

async function loadHeroCarousel() {
    const track = $("#heroCarouselTrack");
    try {
        const response = await fetch(`${THEMEALDB_URL}/filter.php?i=chicken`);
        if (!response.ok) throw new Error("Hero request failed");
        const data = await response.json();
        const recipes = (data.meals || []).slice(0, 3);
        if (!recipes.length) throw new Error("No hero recipes");
        track.innerHTML = recipes.map((recipe, index) => `<div class="hero-slide${index === 0 ? " active" : ""}" data-hero-index="${index}"><img src="${escapeHTML(recipe.strMealThumb)}" alt="${escapeHTML(recipe.strMeal)}"><span class="hero-slide-label">${escapeHTML(recipe.strMeal)}</span></div>`).join("");
        let activeIndex = 0;
        const showSlide = (nextIndex) => {
            activeIndex = (nextIndex + recipes.length) % recipes.length;
            track.querySelectorAll(".hero-slide").forEach((slide, index) => slide.classList.toggle("active", index === activeIndex));
            $("#heroCarouselCaption").textContent = recipes[activeIndex].strMeal;
            $("#heroCarouselCount").textContent = `${String(activeIndex + 1).padStart(2, "0")} / ${String(recipes.length).padStart(2, "0")}`;
        };
        $("#heroPrevious").addEventListener("click", () => showSlide(activeIndex - 1));
        $("#heroNext").addEventListener("click", () => showSlide(activeIndex + 1));
        let rotation = window.setInterval(() => showSlide(activeIndex + 1), 5200);
        track.parentElement.addEventListener("mouseenter", () => window.clearInterval(rotation));
        track.parentElement.addEventListener("mouseleave", () => { rotation = window.setInterval(() => showSlide(activeIndex + 1), 5200); });
    } catch (error) {
        track.innerHTML = '<div class="hero-slide active"><div class="hero-slide-label">Something good is on the way</div></div>';
    }
}

$("#ingredientForm").addEventListener("submit", (event) => { event.preventDefault(); addIngredient(); });
$("#searchForm").addEventListener("submit", (event) => { event.preventDefault(); searchRecipes(); });
$("#buildGroceryButton").addEventListener("click", buildGroceryList);
$("#saveRecipeButton").addEventListener("click", saveCurrentRecipe);
$("#closeModalButton").addEventListener("click", closeModal);
$("#recipeModal").addEventListener("click", (event) => { if (event.target === recipeModal) closeModal(); });
[pantryList, favoritesList, resultsRail].forEach((element) => element.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-ingredient]");
    if (removeButton) { setPantry(getPantry().filter((item) => item !== removeButton.dataset.removeIngredient)); return; }
    handleRecipeInteraction(event);
}));
[pantryList, favoritesList, resultsRail].forEach((element) => element.addEventListener("keydown", (event) => { if ((event.key === "Enter" || event.key === " ") && event.target.closest(".recipe-card")) { event.preventDefault(); handleRecipeInteraction(event); } }));
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !recipeModal.hidden) closeModal(); });
$("#railPrevious").addEventListener("click", () => resultsRail.scrollBy({ left: -340, behavior: "smooth" }));
$("#railNext").addEventListener("click", () => resultsRail.scrollBy({ left: 340, behavior: "smooth" }));
document.querySelectorAll("[data-search]").forEach((button) => button.addEventListener("click", () => searchRecipes(button.dataset.search)));
$("#searchMode").addEventListener("change", (event) => {
    $("#searchInput").placeholder = event.target.value === "name" ? "Search by recipe name..." : "Search recipes by ingredient...";
});
enableRailPointerEffects();
loadHeroCarousel();
renderPantry();
renderFavorites();
updateCounts();
$("#navGroceryCount").textContent = "0";
