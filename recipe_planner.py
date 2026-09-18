import requests
import json
import os

PANTRY_FILE = "pantry.json"
FAVORITES_FILE = "favorites.json"
THEMEALDB_URL = "https://www.themealdb.com/api/json/v1/1"

def load_pantry():
    """Load ingredients from pantry.json"""
    if os.path.exists(PANTRY_FILE):
        with open(PANTRY_FILE, 'r') as f:
            return json.load(f).get("ingredients", [])
    return []

def save_pantry(ingredients):
    """Save ingredients to pantry.json"""
    with open(PANTRY_FILE, 'w') as f:
        json.dump({"ingredients": ingredients}, f, indent=2)

def load_favorites():
    """Load favorite recipes from favorites.json"""
    if os.path.exists(FAVORITES_FILE):
        with open(FAVORITES_FILE, 'r') as f:
            return json.load(f).get("favorites", [])
    return []

def save_favorites(favorites):
    """Save favorite recipes to favorites.json"""
    with open(FAVORITES_FILE, 'w') as f:
        json.dump({"favorites": favorites}, f, indent=2)

def search_recipes_by_ingredient(ingredient):
    """Fetch recipes from TheMealDB by ingredient"""
    url = f"{THEMEALDB_URL}/filter.php?i={ingredient}"
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        return data.get("meals", [])
    except requests.exceptions.RequestException as e:
        print(f"Error fetching recipes: {e}")
        return []

def get_recipe_details(meal_id):
    """Fetch full recipe details (ingredients + instructions) by ID"""
    url = f"{THEMEALDB_URL}/lookup.php?i={meal_id}"
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        meals = data.get("meals", [])
        return meals[0] if meals else None
    except requests.exceptions.RequestException as e:
        print(f"Error fetching recipe details: {e}")
        return None

def extract_ingredients(recipe):
    """Extract ingredients from recipe (TheMealDB has strIngredient1-20 + strMeasure1-20)"""
    ingredients = []
    for i in range(1, 21):
        ingredient_key = f"strIngredient{i}"
        if ingredient_key in recipe and recipe[ingredient_key]:
            ingredient = recipe[ingredient_key].strip().lower()
            if ingredient:
                ingredients.append(ingredient)
    return ingredients

def find_missing_ingredients(recipe_ingredients, pantry):
    """Compare recipe ingredients against pantry, return missing ones"""
    pantry_lower = [ing.lower() for ing in pantry]
    missing = []
    for ingredient in recipe_ingredients:
        if ingredient not in pantry_lower:
            missing.append(ingredient)
    return missing

def display_recipes(recipes, pantry):
    """Show recipes with missing ingredients"""
    if not recipes:
        print("No recipes found.")
        return
    
    for i, recipe in enumerate(recipes[:5], 1):
        print(f"\n{i}. {recipe['strMeal']}")
        print(f"   Link: {recipe['strMealThumb']}")
        
        # Get full details for ingredients
        details = get_recipe_details(recipe['idMeal'])
        if details:
            recipe_ingredients = extract_ingredients(details)
            missing = find_missing_ingredients(recipe_ingredients, pantry)
            
            print(f"   Ingredients needed: {', '.join(recipe_ingredients[:5])}{'...' if len(recipe_ingredients) > 5 else ''}")
            if missing:
                print(f"   ⚠️  Missing: {', '.join(missing)}")
            else:
                print(f"   ✅ You have all ingredients!")

def build_grocery_list(recipe_ids, pantry):
    """Build grocery list from selected recipe IDs"""
    all_missing = set()
    for meal_id in recipe_ids:
        details = get_recipe_details(meal_id)
        if details:
            recipe_ingredients = extract_ingredients(details)
            missing = find_missing_ingredients(recipe_ingredients, pantry)
            all_missing.update(missing)
    
    return sorted(list(all_missing))

def main():
    pantry = load_pantry()
    
    print("=== Recipe Meal Planner ===")
    print(f"Your pantry: {', '.join(pantry)}\n")
    
    while True:
        print("\nOptions:")
        print("1. Search recipes by ingredient")
        print("2. Add ingredient to pantry")
        print("3. Remove ingredient from pantry")
        print("4. View pantry")
        print("5. Build grocery list (from saved recipes)")
        print("6. Exit")
        
        choice = input("Pick an option (1-6): ").strip()
        
        if choice == "1":
            ingredient = input("Enter ingredient to search: ").strip()
            if not ingredient:
                print("Please enter an ingredient.")
                continue
            
            recipes = search_recipes_by_ingredient(ingredient)
            display_recipes(recipes, pantry)
            
            # Option to save to favorites
            save = input("Save any recipes to favorites? (enter recipe number or skip): ").strip()
            if save.isdigit():
                idx = int(save) - 1
                if 0 <= idx < len(recipes):
                    favorites = load_favorites()
                    favorites.append({
                        "name": recipes[idx]['strMeal'],
                        "id": recipes[idx]['idMeal']
                    })
                    save_favorites(favorites)
                    print(f"✅ Saved '{recipes[idx]['strMeal']}'")
        
        elif choice == "2":
            ingredient = input("Enter ingredient to add: ").strip().lower()
            if ingredient and ingredient not in pantry:
                pantry.append(ingredient)
                save_pantry(pantry)
                print(f"✅ Added '{ingredient}'")
            else:
                print("Already in pantry or invalid input.")
        
        elif choice == "3":
            ingredient = input("Enter ingredient to remove: ").strip().lower()
            if ingredient in pantry:
                pantry.remove(ingredient)
                save_pantry(pantry)
                print(f"✅ Removed '{ingredient}'")
            else:
                print("Not found in pantry.")
        
        elif choice == "4":
            print(f"Pantry: {', '.join(pantry) if pantry else 'Empty'}")
        
        elif choice == "5":
            favorites = load_favorites()
            if not favorites:
                print("No saved recipes.")
                continue
            
            print("Saved recipes:")
            for i, fav in enumerate(favorites, 1):
                print(f"{i}. {fav['name']}")
            
            grocery_list = build_grocery_list([fav['id'] for fav in favorites], pantry)
            if grocery_list:
                print(f"\n🛒 Grocery List:\n" + "\n".join(f"  - {item}" for item in grocery_list))
            else:
                print("You have all ingredients for your saved recipes!")
        
        elif choice == "6":
            print("Bye!")
            break
        
        else:
            print("Invalid option.")

if __name__ == "__main__":
    main()