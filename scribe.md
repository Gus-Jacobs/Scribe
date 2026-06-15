# SCRIBE: MASTER ARCHITECTURE & DIRECTIVE SPECIFICATION
**Project:** Scribe (Offline-First Desktop Word Processor)
**Goal:** Evolve the current application into a highly stable, feature-rich, zero-bug productivity suite capable of rivaling Microsoft Word. 

## 1. PROJECT ETHOS & BOUNDARIES
* **Offline-First:** Scribe must function flawlessly without an internet connection. Do not introduce cloud-dependent libraries, external API calls for core features, or web-based processing. 
* **No Framework Churn:** The core stack is strictly locked. Do NOT attempt to migrate away from **Electron**, **React**, **Slate.js**, or **Tailwind CSS**. Your job is to optimize and expand within this ecosystem, not rewrite the foundation.
* **Git Integrity:** When making automated commits, ensure you strictly respect the local Git config and identity overrides already established in this environment.

## 2. THE CRITICAL DIRECTIVE: FIXING THE I/O PIPELINE
The current primary bug is that formatting (bold, lists, tables) is lost when opening/saving standard formats like `.docx`. The previous architecture attempted manual XML parsing via Cheerio and manual serialization via the `docx` package. This has been abandoned. 

**Your immediate task is to implement the HTML-Bridge Pipeline:**
1.  **Importing (DOCX -> Slate):** * Use the `mammoth` package to convert the incoming DOCX buffer into semantic HTML.
    * Write a robust recursive deserializer to parse that HTML into the exact `CustomElement` and `CustomText` JSON structure defined in `src/CustomTypes.ts`.
2.  **Exporting (Slate -> DOCX/PDF):**
    * Utilize the existing `generateHtmlString` logic to convert the Slate JSON state into pristine HTML with inline styles.
    * Use the `html-to-docx` package to bridge this HTML into a buffer for the Electron Main process to save.
    * Use Electron's native `webContents.printToPDF()` for PDF generation. Do NOT use Pandoc as a child process for core formats unless absolutely necessary for edge cases (like .odt).

## 3. FEATURE EXPANSION ROADMAP ("THE EPIC TIER")
Once the I/O pipeline is bulletproof, implement the following features seamlessly into the Slate/React UI:

### A. Advanced Inserts & Media
* **Robust Tables:** Expand the `re-resizable` table integration. Allow dynamic row/column insertion, cell merging, and background shading directly from a floating toolbar.
* **Image Handling:** Ensure images are stored via Base64 or local relative paths safely within the `.scribe` native JSON payload, and serialize them correctly into the HTML bridge for `.docx` exports.
* **Page Breaks:** Implement hard page break elements in the editor that translate correctly to standard Word `<w:br w:type="page"/>` via the HTML bridge.

### B. Templates & Document Management
* **Template Engine:** Build a UI to launch new documents from predefined `.scribe` JSON templates (e.g., "Academic Essay," "Business Letter," "Novel Chapter"). 
* **Dynamic Table of Contents:** Implement an interactive TOC block that auto-generates based on `heading-one`, `heading-two`, and `heading-three` nodes within the Slate state.

### C. UI & Polish
* **Floating Format Menus:** Enhance the Slate UI so that highlighting text brings up a contextual, floating Lucide-icon toolbar (like Notion/Medium) for rapid formatting.
* **Performance:** Optimize the React re-renders. Ensure that typing in a 50-page document remains at 60fps by utilizing `React.memo` and localized state updates where appropriate.

## 4. STRICT CODING STANDARDS
* **TypeScript:** Enforce strict typing. Do not use `any` unless absolutely necessary to bypass a poorly typed third-party module. Update `CustomTypes.ts` if new node types are added.
* **IPC Communication:** Maintain the security boundary. The Renderer process must only communicate via the exposed functions in `preload.ts`. Never enable `nodeIntegration` in the Renderer.
* **Graceful Failures:** Scribe must never hard-crash. Wrap file operations, IPC calls, and complex Slate state changes in try/catch blocks and return standardized error objects to the UI.

**Acknowledge this document.** Your first output should be a step-by-step plan on how you will tackle the "I/O Pipeline" refactor in `index.ts` and `docxParser.ts`.