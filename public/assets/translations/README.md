# AudioCodes RoutingServer - Internationalization (i18n)

This directory contains the translation files and internationalization system for the AudioCodes RoutingServer admin panel.

## File Structure

```
translations/
├── README.md           # This documentation file
├── i18n.js            # Translation helper library
├── en.json            # English translations (base language)
├── template.json      # Empty template for new languages
└── [lang].json        # Additional language files (e.g., es.json, fr.json)
```

## Usage

### 1. Include the i18n library

Add the i18n script to your HTML files:

```html
<script src="/assets/translations/i18n.js" type="module"></script>
```

### 2. Use translation keys in HTML

Add `data-i18n` attributes to elements that need translation:

```html
<!-- Text content -->
<h1 data-i18n="app.title"></h1>
<button data-i18n="common.save"></button>

<!-- Placeholders -->
<input data-i18n-placeholder="auth.username" />

<!-- Titles and tooltips -->
<button data-i18n-title="routes.addRoute"></button>

<!-- Aria labels -->
<button data-i18n-aria="common.close"></button>

<!-- With parameters -->
<span data-i18n="pagination.showing" data-i18n-params='{"start":1,"end":10,"total":100}'></span>
```

### 3. Use in JavaScript

```javascript
// Get translation
const message = i18n.t('messages.operationSuccessful');

// With parameters
const confirmMsg = i18n.t('routes.deleteConfirm', { id: 123 });

// Change language
await i18n.setLanguage('es');

// Translate DOM elements
i18n.translateDOM();
```

## Translation Keys Structure

### App Level
- `app.title` - Application title
- `app.name` - Application name
- `app.subtitle` - Application subtitle

### Authentication
- `auth.*` - Login, logout, password related strings

### Navigation
- `navigation.*` - Menu items, navigation labels

### Feature Modules
- `routes.*` - Route management strings
- `users.*` - User management strings
- `roles.*` - Role management strings
- `tokens.*` - Token management strings
- `profile.*` - User profile strings

### Common Elements
- `common.*` - Buttons, actions, status messages
- `messages.*` - Error messages, notifications
- `pagination.*` - Pagination controls

## Adding New Languages

1. Copy `template.json` to `[language-code].json` (e.g., `es.json` for Spanish)
2. Fill in all translation values
3. Test the translations by setting the language:
   ```javascript
   await i18n.setLanguage('es');
   ```

## Parameter Interpolation

Use `{paramName}` in translation strings for dynamic content:

```json
{
  "routes": {
    "deleteConfirm": "Are you sure you want to delete route #{id}?",
    "editConfirm": "Are you sure you want to edit route #{id}?"
  }
}
```

Usage:
```javascript
const message = i18n.t('routes.deleteConfirm', { id: 123 });
// Result: "Are you sure you want to delete route #123?"
```

## Language Detection

The system automatically detects the user's preferred language in this order:
1. Previously selected language (stored in localStorage)
2. Browser language setting
3. Fallback to English

## Best Practices

1. **Use descriptive keys**: `auth.username` instead of `username`
2. **Group related strings**: Keep all route-related strings under `routes.*`
3. **Avoid HTML in translations**: Keep translations as plain text
4. **Use parameters for dynamic content**: Don't concatenate strings
5. **Test all languages**: Ensure UI layout works with longer/shorter text
6. **Keep fallbacks**: Always provide English translations as fallback

## Current Translation Coverage

### Extracted Strings from HTML Files:
- **admin.html**: Page title, form labels, button text
- **navbar.html**: Navigation menu items
- **header.html**: Application title and subtitle
- **auth.html**: Login form elements
- **routes.html**: Route management interface
- **users.html**: User management interface
- **roles.html**: Role management interface
- **tokens.html**: Token management interface
- **profile.html**: User profile interface
- **help.html**: Help section title

### Extracted Strings from JavaScript:
- **admin.js**: Confirmation messages, error messages, dynamic content
- API error messages and user feedback
- Form validation messages
- Success/failure notifications

## Language Support Status

- ✅ **English (en)**: Complete base language
- 📝 **Template**: Available for new languages
- ⏳ **Other languages**: Ready for translation

## Implementation Notes

- The i18n system loads asynchronously and translates the DOM automatically
- Language changes trigger a `languageChanged` event for custom handling
- All user-facing strings have been extracted and organized by feature
- The system supports nested translation keys using dot notation
- Parameter interpolation uses `{key}` syntax for dynamic content
