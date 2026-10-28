export const campCategories = [
  {
    id: "general",
    name: "Informations générales",
    icon: "⛺",
    fields: [
      ["title", "Nom du camp"],
      ["location", "Lieu"],
      ["start", "Date de début", "date"],
      ["end", "Date de fin", "date"],
      ["leader", "Responsable"],
      ["theme", "Thème du camp"],
    ],
  },
  {
    id: "team",
    name: "Équipe & participants",
    icon: "👥",
    fields: [
      ["leaders", "Maîtrise et rôles", "textarea"],
      ["participants", "Participants", "textarea"],
      ["services", "Équipe de service et intervenants", "textarea"],
    ],
  },
  {
    id: "goals",
    name: "Objectifs",
    icon: "🎯",
    fields: [
      ["goals", "Nos objectifs", "textarea"],
      ["steps", "Comment y arriver ?", "textarea"],
    ],
  },
  {
    id: "program",
    name: "Programme",
    icon: "📅",
    fields: [
      ["schedule", "Programme par jour et horaires", "textarea"],
      ["outings", "Sorties et déplacements", "textarea"],
      ["activities", "Ateliers et veillées", "textarea"],
    ],
  },
  {
    id: "preparation",
    name: "Préparations",
    icon: "✅",
    fields: [
      ["tasks", "Tâches, responsables et échéances", "textarea"],
      ["permissions", "Autorisations et démarches", "textarea"],
      ["checklist", "Avant et après le camp", "textarea"],
    ],
  },
  {
    id: "contacts",
    name: "Contacts utiles",
    icon: "☎",
    fields: [
      ["emergency", "Numéros d’urgence et centre médical", "textarea"],
      ["contacts", "Responsables, propriétaire et autres contacts", "textarea"],
    ],
  },
  {
    id: "menu",
    name: "Menus & intendance",
    icon: "🍲",
    fields: [
      ["meals", "Repas par jour", "textarea"],
      ["ingredients", "Ingrédients et quantités", "textarea"],
      ["diet", "Régimes et allergies à prévoir", "textarea"],
    ],
  },
  {
    id: "budget",
    name: "Budget & dépenses",
    icon: "💰",
    fields: [
      ["currency", "Devise"],
      ["contribution", "Cotisation par participant", "number"],
      ["participantsCount", "Nombre de participants", "number"],
      ["expenses", "Dépenses prévues / réelles et montants", "textarea"],
      ["receipts", "Références des factures", "textarea"],
    ],
  },
  {
    id: "equipment",
    name: "Matériel",
    icon: "🎒",
    fields: [
      ["camping", "Tentes et installations", "textarea"],
      ["kitchen", "Cuisine et entretien", "textarea"],
      ["firstAid", "Trousse de secours", "textarea"],
      ["other", "Autre matériel et quantités", "textarea"],
    ],
  },
  {
    id: "review",
    name: "Bilan & remerciements",
    icon: "✦",
    fields: [
      ["positives", "Ce qui a bien marché", "textarea"],
      ["improvements", "À améliorer", "textarea"],
      ["thanks", "Remerciements", "textarea"],
    ],
  },
];
export function createCamp(id, title, date) {
  return { id, title, created: date, fields: { title }, updated: Date.now() };
}
