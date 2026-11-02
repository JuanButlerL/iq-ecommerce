// Professional team behind the product selection, as sent by the IQ Kids team (Nov 2026).
// Names and licenses are published verbatim: don't edit them without their confirmation.
export const nutritionists = [
  { name: "Maria Agustina Dahse", license: "MN 8062" },
  { name: "Andrea Estelles", license: "MN 10710" },
  { name: "Elzita Borges", license: "MN 1967/2" },
  { name: "Fiorella Apreda Brun", license: "MN 9773" },
] as const;

export const NUTRITIONISTS_PATH = "/nutricionistas";

// Official recipes and allergen lines sent by the IQ Kids team on 2026-10-28.
// They chose not to publish ingredient percentages.
export const barFacts = [
  {
    flavor: "Maní",
    ingredients: ["dátil", "pasa de uva", "harina de almendra", "harina de maní", "pasta de maní"],
    allergens:
      "Contiene maní y derivados de almendras. Puede contener avellanas, castañas de cajú, huevo, derivados de leche y de soja.",
  },
  {
    flavor: "Cacao",
    ingredients: ["dátil", "pasa de uva", "harina de almendra", "cacao natural en polvo"],
    allergens: "Contiene derivados de almendras. Puede contener avellanas, castañas de cajú, huevo, derivados de leche y de soja.",
  },
  {
    flavor: "Banana",
    ingredients: ["dátil", "pasa de uva", "harina de almendra", "pasta de maní", "cacao", "banana liofilizada"],
    allergens:
      "Contiene maní y derivados de almendras. Puede contener avellanas, castañas de cajú, huevo, derivados de leche y de soja.",
  },
] as const;

export const barBasics = {
  portion: "30 g",
  recommendedAge: "desde 1 año",
  shelfLife: "5 meses desde la elaboración",
};

export function listNutritionists() {
  const items = nutritionists.map((person) => `${person.name} (${person.license})`);
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}
