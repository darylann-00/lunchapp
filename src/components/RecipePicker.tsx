import { useRef, useState } from 'react';
import type { RecipeWithTags } from '../lib/recipes';

type Props = {
  value: string;
  recipes: RecipeWithTags[];
  onSelectRecipe: (recipe: RecipeWithTags) => void;
  onCustomName: (name: string) => void;
  placeholder?: string;
};

export function RecipePicker({
  value,
  recipes,
  onSelectRecipe,
  onCustomName,
  placeholder = 'Pick a recipe or type a name...',
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  // Filter recipes by name (case-insensitive substring match)
  const filtered = recipes.filter((r) =>
    r.name.toLowerCase().includes(filterText.toLowerCase())
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterText(e.currentTarget.value);
    setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleCaretClick = () => {
    setIsOpen(!isOpen);
    inputRef.current?.focus();
  };

  const handleSelectRecipe = (recipe: RecipeWithTags) => {
    setFilterText(recipe.name);
    onSelectRecipe(recipe);
    scheduleClose();
  };

  const handleInputBlur = () => {
    scheduleClose();
    // If the text doesn't match exactly, call onCustomName
    const exactMatch = recipes.some(
      (r) => r.name.toLowerCase() === filterText.toLowerCase()
    );
    if (filterText && !exactMatch) {
      onCustomName(filterText);
    }
  };

  const scheduleClose = () => {
    if (closeTimeoutRef.current !== null) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const exactMatch = recipes.find(
        (r) => r.name.toLowerCase() === filterText.toLowerCase()
      );
      if (exactMatch) {
        handleSelectRecipe(exactMatch);
      } else if (filterText) {
        onCustomName(filterText);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      {/* Input with caret button */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={filterText}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="luncharoo-border rounded-xl px-3 py-2 pr-10 text-sm font-fredoka text-luncharoo-dark bg-white focus:outline-none focus:ring-1 focus:ring-luncharoo-blue w-full"
        />
        <button
          onClick={handleCaretClick}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-luncharoo-dark hover:text-luncharoo-blue transition-colors"
          tabIndex={-1}
        >
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      {/* Dropdown list */}
      {isOpen && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white luncharoo-border rounded-xl luncharoo-shadow-sm z-50 max-h-48 overflow-y-auto">
          {filtered.map((recipe, index) => (
            <button
              key={recipe.id}
              onClick={() => handleSelectRecipe(recipe)}
              className={`w-full px-3 py-2 text-sm font-fredoka cursor-pointer hover:bg-luncharoo-blue/10 text-left flex items-center justify-between transition-colors ${
                index < filtered.length - 1 ? 'border-b border-luncharoo-dark/10' : ''
              }`}
            >
              <span className="text-luncharoo-dark">{recipe.name}</span>
              {recipe.prepTimeMinutes !== null && recipe.prepTimeMinutes !== undefined && (
                <span className="text-xs text-slate-400 ml-auto">
                  {recipe.prepTimeMinutes}m
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Empty state message */}
      {isOpen && filterText && filtered.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white luncharoo-border rounded-xl luncharoo-shadow-sm z-50 px-3 py-2">
          <p className="text-xs text-slate-400">No recipes match "{filterText}"</p>
        </div>
      )}
    </div>
  );
}
