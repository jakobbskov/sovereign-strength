window.I18N = {
  lang: localStorage.getItem("ss_lang") || "da",
  dict: {},

  async load(lang) {
    const res = await fetch(`./i18n/${lang}.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Could not load language file: ${lang}`);
    this.dict = await res.json();
    this.lang = lang;
    localStorage.setItem("ss_lang", lang);
    document.documentElement.lang = lang;
  },

  t(key, vars = {}) {
    let text = this.dict[key] || key;
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
    return text;
  }
};

window.t = function(key, vars = {}) {
  return window.I18N.t(key, vars);
};
