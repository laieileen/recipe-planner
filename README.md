# Recipe Meal Planner

Stop staring at your fridge wondering what to cook. Search recipes by ingredient, save your favorites, and build a grocery list from what you're actually missing.

**[Try it here →](https://YOUR_USERNAME.github.io/recipe-planner)**

## How It Works

- **Search by ingredient**: Type "chicken" and get recipes that use it
- **Manage your pantry**: Add/remove ingredients you already have
- **Click for details**: See full recipe with instructions
- **Save favorites**: Build your collection of go-to meals
- **Generate grocery list**: See all missing ingredients across saved recipes in one place

All data is saved to your browser. No account is necessary and all information is private.

## API

Uses **TheMealDB** (free, no authentication required):
- `GET /filter.php?i={ingredient}` — Search recipes by ingredient
- `GET /lookup.php?i={meal_id}` — Get full recipe details (ingredients + instructions)

Returns JSON with recipe name, ingredients, measurements, and step-by-step instructions.

## Running Locally

```bash
# Just open it
open index.html

# Or serve it if you have Python 3
python3 -m http.server 8000
# Then go to http://localhost:8000
```

## Files

- `index.html` — The whole app (HTML + CSS + JavaScript)
- `README.md` — This file
- `prompt_log.md` — Prompts used to create this project
