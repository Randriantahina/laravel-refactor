# Laravel Refactor (VS Code Extension)

A powerful VS Code extension that automatically refactors your Laravel code when you rename or move PHP files.

## Features

Automatically triggered on file rename inside VS Code.

### What it does:

- Updates **namespace** based on file location (PSR-4)
- Renames the **class name** to match the file name
- Updates all **references across the project**
  - `use App\...`
  - class imports

### Example

#### Before rename

```php
namespace App\Services;

class TestService {}
```
