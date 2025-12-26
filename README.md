# Auto Wiz

**Auto Wiz** is a browser extension designed to record, edit, and replay user interactions on the web. It features a robust locator system that ensures reliable element selection even when page structures change.

## 🏗️ Monorepo Structure

This project is a monorepo managed with **pnpm workspaces**.

- **`apps/extension`**  
  The main browser extension application built with [WXT](https://wxt.dev) and React. It acts as the consumer of the core logic and UI components.

- **`packages/core`**  
  Contains the core business logic of the automation engine, including:

  - **Selectors**: Robust element locator generation and resolution strategies.
  - **Steps**: Execution logic for various actions (click, type, extract, etc.).
  - **Storage**: Interfaces and adapters for storing flow data.
  - **Types**: Shared TypeScript definitions.

- **`packages/ui`**  
  A shared UI library containing reusable React components used by the extension (e.g., Flow controls, Step items).

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [pnpm](https://pnpm.io/) (v8 or higher)

### Installation

1. Clone the repository.
2. Install dependencies for all packages from the root directory:

```bash
pnpm install
```

### Building the Project

To build all packages in the correct order (core -> ui -> extension):

```bash
pnpm -r build
```

## 🛠️ Development

### Running the Extension

1. Navigate to the extension directory:

   ```bash
   cd apps/extension
   ```

2. Start the development server (auto-reloads on changes):

   ```bash
   pnpm dev
   ```

3. Open **Chrome** and navigate to `chrome://extensions`.
4. Enable **Developer Mode**.
5. Click **Load unpacked** and select the `.output/chrome-mv3` directory generated in `apps/extension`.

### Working on Core or UI Packages

Changes in `packages/core` or `packages/ui` will be automatically reflected in the extension if you are running `pnpm dev` in `apps/extension`, thanks to Vite's HMR and pnpm workspace symlinks.

To strictly type-check or build a specific package:

```bash
pnpm --filter @auto-wiz/core build
pnpm --filter @auto-wiz/ui build
```

## ✨ Features

- **Record & Replay**: Capture user interactions like clicks, typing, and navigation, then replay them automatically.
- **Robust Locators**: Automatically generates multiple fallback selectors (ID, TestID, Text, Attributes) to make automation scripts resilient to UI changes.
- **Visual Editor**: Edit steps, reorder them, or modify their properties directly in the side panel.
- **Export**: (Planned) Export flows to other formats.

## 🧪 Testing

To run tests for the extension (which also covers core logic integration):

```bash
cd apps/extension
pnpm test
```
