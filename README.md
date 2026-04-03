# Laravel Refactor

Extension VS Code qui refactorise automatiquement un projet Laravel quand vous renommez ou déplacez un fichier PHP.

Elle ajuste le namespace, le nom de classe, les imports et les usages dans le reste du projet, y compris quand vous:

- renommez un fichier PHP
- déplacez un fichier dans un sous-dossier
- renommez le dossier parent d’un ensemble de fichiers PHP

---

## Fonctionnalités

- Mise à jour du `namespace` selon l’emplacement PSR-4
- Renommage de la classe pour qu’elle corresponde au nom du fichier
- Mise à jour des références dans le projet
  - imports `use ...`
  - références FQCN comme `App\\Services\\TestService`
  - usages du nom court quand c’est possible
- Gestion des renommages de dossiers
- Détection des conflits de nommage

## Comportement en cas de conflit

Si deux `use` dans un fichier importent déjà le même nom court depuis deux namespaces différents, l’extension affiche un message de conflit.

Dans ce cas:

- le renommage de classe est annulé pour ce fichier
- le fichier est remis à son nom d’origine
- un avertissement est affiché dans le panneau `Laravel Refactor`

---

## Exemple

### Avant renommage

```php
namespace App\Services;

class TestService {}
```

```php
use App\Services\TestService;
```

### Après renommage du fichier en `UserService.php`

```php
namespace App\Services;

class UserService {}
```

```php
use App\Services\UserService;
```

---

## Comment ça marche

- Analyse PHP via `php-parser`
- Détection du namespace et de la classe à partir du fichier ou du chemin
- Mise à jour des usages dans le projet
- Application des conventions PSR-4 de Laravel

---

## Installation

### Prérequis

- VS Code
- Un projet Laravel
- Des fichiers PHP dans le dossier `app/`

### Dépendances

```bash
pnpm install
```

---

## Utilisation

1. Ouvrez votre projet Laravel dans VS Code
2. Renommez un fichier PHP ou déplacez-le
3. L’extension propose ou applique le refactor
4. Vérifiez le panneau `Laravel Refactor` pour voir les changements et les éventuels conflits

---

## Développement

### Compiler l’extension

```bash
pnpm run compile
```

### Lancer en mode développement

```bash
F5
```

### Tester

1. Ouvrez un projet Laravel dans l’`Extension Development Host`
2. Renommez un fichier PHP dans `app/`
3. Vérifiez que:
   - le namespace est mis à jour
   - le nom de classe suit le nouveau nom de fichier
   - les imports et usages sont mis à jour

---

## Publication sur le VS Code Marketplace

### 1. Préparer les métadonnées

Avant de publier, vérifiez dans `package.json`:

- `name`
- `displayName`
- `description`
- `version`
- `engines.vscode`
- `publisher`

Le champ `publisher` est obligatoire pour la publication.

### 2. Installer l’outil de publication

```bash
npm install -g @vscode/vsce
```

### 3. Se connecter au Marketplace

Créez un compte éditeur sur le [VS Code Marketplace](https://marketplace.visualstudio.com/vscode), puis générez un Personal Access Token côté Azure DevOps avec le scope `Marketplace: Manage`.

Ensuite, enregistrez l’éditeur localement:

```bash
vsce login <publisher-id>
```

Le `<publisher-id>` doit correspondre au champ `publisher` de votre `package.json`.

### 4. Packager l’extension

```bash
vsce package
```

Cette commande produit un fichier `.vsix` pour tester localement.

### 5. Tester le `.vsix`

```bash
code --install-extension votre-extension.vsix
```

### 6. Publier

Quand tout est validé:

```bash
vsce publish
```

Vous pouvez aussi laisser `vsce` incrémenter la version automatiquement:

```bash
vsce publish patch
vsce publish minor
vsce publish major
```

---

## Notes

- La mise à jour des références s’appuie sur des remplacements texte et non sur un refactoring AST complet pour tout le projet.
- Les cas avancés comme les alias `use ... as ...`, les traits ou plusieurs classes dans un même fichier restent des zones à surveiller.
