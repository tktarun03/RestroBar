// UI text. Write UI in English and wrap it in t(). The English sentence is the key.
// Add a language by adding a table below: one row per string, {name} placeholders
// for numbers and names. Keep user data (dish names, table names) out of the table.
// Machine translations must be marked "needs native review" in ROADMAP.md.
const I18n = (() => {
  const TABLES = {
    en: {} // English is the key itself
    // ar: { 'Tables': 'الطاولات', ... }  // not started, see ROADMAP.md
  };
  let lang = 'en';

  const t = (key, vars) => {
    const row = (TABLES[lang] && TABLES[lang][key]) || key;
    if (!vars) return row;
    return row.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : '{' + k + '}'));
  };

  const setLang = (l) => { lang = TABLES[l] ? l : 'en'; document.documentElement.lang = lang; };
  const languages = () => Object.keys(TABLES);

  return { t, setLang, languages };
})();
const t = I18n.t;
