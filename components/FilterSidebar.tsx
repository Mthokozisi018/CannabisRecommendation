import type { ProductFilters } from "@/lib/types";

type Options = {
  brands: string[];
  strainTypes: string[];
  growTypes: string[];
  subcategories: string[];
  dietary: string[];
  ratioTags: string[];
  hardwareFacets: string[];
  concentrateSubtypes: string[];
};

function Select({ name, label, options, value }: { name: string; label: string; options: string[]; value?: string }) {
  if (options.length === 0) return null;
  return (
    <label className="block">
      <span className="text-xs text-white/50">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-ink px-3 text-sm">
        <option value="">Any</option>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

export function FilterSidebar({ options, filters, category, effect = "relaxed" }: { options: Options; filters: ProductFilters; category?: string; effect?: string }) {
  const showHardware = category === "vapes";
  const showConcentrate = category === "concentrates";
  const showDietary = category === "edibles" || category === "oils-supplements" || !category;
  return (
    <form className="rounded-lg border border-white/10 bg-panel/80 p-4">
      <input type="hidden" name="effect" value={effect} />
      <div className="mb-4">
        <h2 className="font-semibold">Filters</h2>
        <p className="text-xs text-white/45">Category-aware refinements</p>
      </div>
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs text-white/50">Search</span>
          <input name="query" defaultValue={filters.query} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-ink px-3 text-sm" placeholder="Name, brand, strain, flavor" />
        </label>
        <Select name="subcategory" label="Subcategory" options={options.subcategories} value={filters.subcategory} />
        <Select name="brand" label="Brand" options={options.brands} value={filters.brand} />
        <Select name="strainType" label="Strain type" options={options.strainTypes} value={filters.strainType} />
        {category === "flower" || !category ? <Select name="growType" label="Grow type" options={options.growTypes} value={filters.growType} /> : null}
        {showDietary ? <Select name="dietary" label="Dietary" options={options.dietary} value={filters.dietary} /> : null}
        <Select name="ratioTag" label="Ratio tag" options={options.ratioTags} value={filters.ratioTag} />
        {showHardware ? <Select name="hardwareFacet" label="Hardware" options={options.hardwareFacets} value={filters.hardwareFacet} /> : null}
        {showConcentrate ? <Select name="concentrateSubtype" label="Concentrate type" options={options.concentrateSubtypes} value={filters.concentrateSubtype} /> : null}
        <div className="grid grid-cols-2 gap-2">
          <input name="thcMin" defaultValue={filters.thcMin} className="h-10 rounded-lg border border-white/10 bg-ink px-3 text-sm" placeholder="THC min" />
          <input name="thcMax" defaultValue={filters.thcMax} className="h-10 rounded-lg border border-white/10 bg-ink px-3 text-sm" placeholder="THC max" />
          <input name="priceMin" defaultValue={filters.priceMin} className="h-10 rounded-lg border border-white/10 bg-ink px-3 text-sm" placeholder="R min" />
          <input name="priceMax" defaultValue={filters.priceMax} className="h-10 rounded-lg border border-white/10 bg-ink px-3 text-sm" placeholder="R max" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="inStockOnly" value="true" defaultChecked={filters.inStockOnly} className="size-4 accent-mint" />
          In stock only
        </label>
        <button className="h-10 w-full rounded-lg bg-mint font-semibold text-ink">Apply</button>
      </div>
    </form>
  );
}
