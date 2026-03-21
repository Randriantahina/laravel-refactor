# Laravel Refactor (VS Code Extension)

A powerful VS Code extension that automatically refactors your Laravel code when you rename or move PHP files.

---

## Features

Automatically triggered on file rename inside VS Code.

### What it does:

- Updates **namespace** based on file location (PSR-4)
- Renames the **class name** to match the file name
- Updates all **references across the project**
  - `use App\...`
  - class imports

---

## Example

### Before rename

```php
namespace App\Services;

class TestService {}
```

```php
use App\Services\TestService;
```

---

### After renaming file → `UserService.php`

```php
namespace App\Services;

class UserService {}
```

```php
use App\Services\UserService;
```

---

## How it works

- Uses **AST parsing** via `php-parser`
- Detects namespace and class automatically
- Applies Laravel **PSR-4 conventions**
- Scans the entire project to update references

---

## Requirements

- VS Code
- A Laravel project
- PHP files located inside the `app/` directory

### Dependencies

```bash
npm install php-parser glob
```

---

## Extension Settings

Currently no custom settings.

---

## Known Issues

- Reference updates use simple string replacement (not full AST yet)
- May affect edge cases (strings, comments)
- Does not yet support:
  - aliases (`use ... as ...`)
  - multiple classes per file
  - traits and interfaces

---

## 🛠️ Development

### Run the extension

```bash
npm run compile
```

Then press:

```bash
F5
```

---

### Test the extension

1. Open a Laravel project in the **Extension Development Host**
2. Rename a PHP file inside `app/`
3. The extension will:
   - Update namespace
   - Update class name
   - Update all references
