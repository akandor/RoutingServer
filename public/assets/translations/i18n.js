/**
 * Internationalization (i18n) helper for AudioCodes RoutingServer
 * Provides translation functionality for multilingual support
 */

class I18n {
  constructor() {
    this.currentLanguage = 'en';
    this.translations = {};
    this.fallbackLanguage = 'en';
  }

  /**
   * Initialize i18n with default language
   * @param {string} language - Language code (e.g., 'en', 'es', 'fr')
   */
  async init(language = 'en') {
    this.currentLanguage = language;
    await this.loadTranslations(language);
    
    // Load fallback language if different
    if (language !== this.fallbackLanguage) {
      await this.loadTranslations(this.fallbackLanguage);
    }
  }

  /**
   * Load translation file for specified language
   * @param {string} language - Language code
   */
  async loadTranslations(language) {
    try {
      const response = await fetch(`/assets/translations/${language}.json`);
      if (response.ok) {
        this.translations[language] = await response.json();
      } else {
        console.warn(`Translation file for ${language} not found`);
      }
    } catch (error) {
      console.error(`Failed to load translations for ${language}:`, error);
    }
  }

  /**
   * Get translated string by key path
   * @param {string} key - Translation key (dot notation, e.g., 'auth.username')
   * @param {Object} params - Parameters for string interpolation
   * @returns {string} Translated string
   */
  t(key, params = {}) {
    let translation = this.getNestedValue(this.translations[this.currentLanguage], key);
    
    // Fallback to default language if translation not found
    if (!translation && this.currentLanguage !== this.fallbackLanguage) {
      translation = this.getNestedValue(this.translations[this.fallbackLanguage], key);
    }
    
    // Return key if no translation found
    if (!translation) {
      console.warn(`Translation not found for key: ${key}`);
      return key;
    }

    // Replace parameters in translation string
    return this.interpolate(translation, params);
  }

  /**
   * Get nested object value by dot notation key
   * @param {Object} obj - Object to search in
   * @param {string} key - Dot notation key
   * @returns {*} Value or undefined
   */
  getNestedValue(obj, key) {
    if (!obj) return undefined;
    return key.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  /**
   * Replace parameters in translation string
   * @param {string} str - String with placeholders
   * @param {Object} params - Parameters to replace
   * @returns {string} Interpolated string
   */
  interpolate(str, params) {
    return str.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }

  /**
   * Change current language
   * @param {string} language - New language code
   */
  async setLanguage(language) {
    if (language !== this.currentLanguage) {
      await this.loadTranslations(language);
      this.currentLanguage = language;
      
      // Store preference in localStorage
      localStorage.setItem('preferred-language', language);
      
      // Trigger language change event
      document.dispatchEvent(new CustomEvent('languageChanged', { 
        detail: { language } 
      }));
    }
  }

  /**
   * Get current language
   * @returns {string} Current language code
   */
  getCurrentLanguage() {
    return this.currentLanguage;
  }

  /**
   * Get available languages
   * @returns {Array} Array of available language codes
   */
  getAvailableLanguages() {
    return Object.keys(this.translations);
  }

  /**
   * Translate HTML element content by data-i18n attribute
   * @param {Element} element - Element to translate (default: document)
   */
  translateDOM(element = document) {
    // Translate elements with data-i18n attribute
    element.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const params = el.dataset.i18nParams ? JSON.parse(el.dataset.i18nParams) : {};
      el.textContent = this.t(key, params);
    });

    // Translate placeholder attributes
    element.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = this.t(key);
    });

    // Translate title attributes
    element.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      el.title = this.t(key);
    });

    // Translate aria-label attributes
    element.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      el.setAttribute('aria-label', this.t(key));
    });
  }

  /**
   * Get user's preferred language from browser/localStorage
   * @returns {string} Preferred language code
   */
  getPreferredLanguage() {
    // Check localStorage first
    const stored = localStorage.getItem('preferred-language');
    if (stored) return stored;

    // Check browser language
    const browserLang = navigator.language.split('-')[0];
    return browserLang || this.fallbackLanguage;
  }
}

// Create global i18n instance
window.i18n = new I18n();

// Auto-initialize with preferred language
document.addEventListener('DOMContentLoaded', async () => {
  const preferredLang = window.i18n.getPreferredLanguage();
  await window.i18n.init(preferredLang);
  window.i18n.translateDOM();
});

// Re-translate DOM when language changes
document.addEventListener('languageChanged', () => {
  window.i18n.translateDOM();
});

export default window.i18n;
