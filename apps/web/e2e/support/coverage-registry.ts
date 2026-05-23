import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

export type CoverageStatus = "PASS" | "FAIL" | "FLAKE" | "BLOCKED" | "ALREADY_TESTED" | "UNTESTABLE";

export interface RegistryTestResult {
  testId: string;
  title: string;
  status: CoverageStatus;
  durationMs: number;
  evidenceId: string;
  notes?: string;
}

export interface RegistryNetworkCall {
  method: string;
  url: string;
  status?: number;
  resourceType?: string;
  failureText?: string;
}

export interface RegistryForm {
  route: string;
  selector: string;
  action?: string;
  method?: string;
  fieldCount: number;
  fields: string[];
}

export interface RegistryElement {
  route: string;
  selector: string;
  text?: string;
  role?: string;
}

export interface RegistryStorageSnapshot {
  route: string;
  localStorageKeys: string[];
  sessionStorageKeys: string[];
  cookieNames: string[];
}

export interface RegistryState {
  runId: string;
  generatedAt: string;
  ROUTES: string[];
  COMPONENTS: RegistryElement[];
  FORMS: RegistryForm[];
  BUTTONS: RegistryElement[];
  MODALS: RegistryElement[];
  DROPDOWNS: RegistryElement[];
  TABLES: RegistryElement[];
  API_CALLS: RegistryNetworkCall[];
  WEBSOCKET_EVENTS: string[];
  AUTH_STATES: string[];
  USER_ROLES: string[];
  FEATURE_FLAGS: string[];
  FILE_OPERATIONS: string[];
  EDITOR_STATES: string[];
  TERMINAL_STATES: string[];
  WORKSPACE_STATES: string[];
  UNTESTED_ITEMS: string[];
  TEST_RESULTS: RegistryTestResult[];
  CRITICAL_BUGS: string[];
  STORAGE_SNAPSHOTS: RegistryStorageSnapshot[];
  CONSOLE_WARNINGS: string[];
  CONSOLE_ERRORS: string[];
}

function normalizeRoute(raw: string): string {
  if (!raw) {
    return "";
  }

  try {
    const url = new URL(raw, "http://localhost");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return raw;
  }
}

export class CoverageRegistry {
  private readonly state: RegistryState;

  constructor(runId: string) {
    this.state = {
      runId,
      generatedAt: new Date().toISOString(),
      ROUTES: [],
      COMPONENTS: [],
      FORMS: [],
      BUTTONS: [],
      MODALS: [],
      DROPDOWNS: [],
      TABLES: [],
      API_CALLS: [],
      WEBSOCKET_EVENTS: [],
      AUTH_STATES: [],
      USER_ROLES: [],
      FEATURE_FLAGS: [],
      FILE_OPERATIONS: [],
      EDITOR_STATES: [],
      TERMINAL_STATES: [],
      WORKSPACE_STATES: [],
      UNTESTED_ITEMS: [],
      TEST_RESULTS: [],
      CRITICAL_BUGS: [],
      STORAGE_SNAPSHOTS: [],
      CONSOLE_WARNINGS: [],
      CONSOLE_ERRORS: [],
    };
  }

  public recordRoute(route: string): void {
    const normalized = normalizeRoute(route);
    if (normalized && !this.state.ROUTES.includes(normalized)) {
      this.state.ROUTES.push(normalized);
    }
  }

  public recordAuthState(authState: string): void {
    if (!this.state.AUTH_STATES.includes(authState)) {
      this.state.AUTH_STATES.push(authState);
    }
  }

  public recordRole(role: string): void {
    if (!this.state.USER_ROLES.includes(role)) {
      this.state.USER_ROLES.push(role);
    }
  }

  public addUntestedItem(item: string): void {
    if (!this.state.UNTESTED_ITEMS.includes(item)) {
      this.state.UNTESTED_ITEMS.push(item);
    }
  }

  public resolveUntestedItem(item: string): void {
    this.state.UNTESTED_ITEMS = this.state.UNTESTED_ITEMS.filter((entry) => entry !== item);
  }

  public addCriticalBug(bug: string): void {
    this.state.CRITICAL_BUGS.push(bug);
  }

  public addTestResult(result: RegistryTestResult): void {
    this.state.TEST_RESULTS.push(result);
  }

  public addNetworkCall(call: RegistryNetworkCall): void {
    const normalized = { ...call, url: normalizeRoute(call.url) || call.url };
    this.state.API_CALLS.push(normalized);
    if (normalized.url.startsWith("/api")) {
      this.recordRoute(normalized.url);
    }
  }

  public addConsoleWarning(message: string): void {
    this.state.CONSOLE_WARNINGS.push(message);
  }

  public addConsoleError(message: string): void {
    this.state.CONSOLE_ERRORS.push(message);
  }

  public addStorageSnapshot(snapshot: RegistryStorageSnapshot): void {
    this.state.STORAGE_SNAPSHOTS.push(snapshot);
  }

  public recordButton(element: RegistryElement): void {
    this.pushUniqueElement(this.state.BUTTONS, element);
  }

  public recordComponent(element: RegistryElement): void {
    this.pushUniqueElement(this.state.COMPONENTS, element);
  }

  public recordModal(element: RegistryElement): void {
    this.pushUniqueElement(this.state.MODALS, element);
  }

  public recordDropdown(element: RegistryElement): void {
    this.pushUniqueElement(this.state.DROPDOWNS, element);
  }

  public recordTable(element: RegistryElement): void {
    this.pushUniqueElement(this.state.TABLES, element);
  }

  public recordForm(form: RegistryForm): void {
    if (
      !this.state.FORMS.some(
        (entry) =>
          entry.route === form.route &&
          entry.selector === form.selector &&
          entry.method === form.method &&
          entry.action === form.action,
      )
    ) {
      this.state.FORMS.push(form);
    }
  }

  public discoveredCount(): number {
    return (
      this.state.ROUTES.length +
      this.state.COMPONENTS.length +
      this.state.FORMS.length +
      this.state.BUTTONS.length +
      this.state.MODALS.length +
      this.state.DROPDOWNS.length +
      this.state.TABLES.length +
      this.state.API_CALLS.length
    );
  }

  public snapshot(): RegistryState {
    return {
      ...this.state,
      ROUTES: [...this.state.ROUTES].sort(),
      AUTH_STATES: [...this.state.AUTH_STATES].sort(),
      USER_ROLES: [...this.state.USER_ROLES].sort(),
      FEATURE_FLAGS: [...this.state.FEATURE_FLAGS].sort(),
      FILE_OPERATIONS: [...this.state.FILE_OPERATIONS].sort(),
      WEBSOCKET_EVENTS: [...this.state.WEBSOCKET_EVENTS].sort(),
      UNTESTED_ITEMS: [...this.state.UNTESTED_ITEMS].sort(),
      STORAGE_SNAPSHOTS: [...this.state.STORAGE_SNAPSHOTS],
      TEST_RESULTS: [...this.state.TEST_RESULTS],
      API_CALLS: [...this.state.API_CALLS],
      COMPONENTS: [...this.state.COMPONENTS],
      FORMS: [...this.state.FORMS],
      BUTTONS: [...this.state.BUTTONS],
      MODALS: [...this.state.MODALS],
      DROPDOWNS: [...this.state.DROPDOWNS],
      TABLES: [...this.state.TABLES],
      CONSOLE_WARNINGS: [...this.state.CONSOLE_WARNINGS],
      CONSOLE_ERRORS: [...this.state.CONSOLE_ERRORS],
    };
  }

  public flush(outputFilePath: string): void {
    const outputDirectory = path.dirname(outputFilePath);
    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(outputFilePath, `${JSON.stringify(this.snapshot(), null, 2)}\n`, "utf8");
  }

  private pushUniqueElement(target: RegistryElement[], element: RegistryElement): void {
    if (!target.some((entry) => entry.route === element.route && entry.selector === element.selector)) {
      target.push(element);
    }
  }
}

export async function scanPageSurface(page: Page, registry: CoverageRegistry): Promise<void> {
  const route = normalizeRoute(page.url());
  registry.recordRoute(route);

  const storageSnapshot = await page.evaluate(() => {
    const localStorageKeys = Object.keys(localStorage);
    const sessionStorageKeys = Object.keys(sessionStorage);
    const cookieNames = document.cookie
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((cookie) => cookie.split("=")[0]);

    return {
      localStorageKeys,
      sessionStorageKeys,
      cookieNames,
    };
  });

  registry.addStorageSnapshot({
    route,
    localStorageKeys: storageSnapshot.localStorageKeys,
    sessionStorageKeys: storageSnapshot.sessionStorageKeys,
    cookieNames: storageSnapshot.cookieNames,
  });

  const discovered = await page.evaluate(() => {
    type NodeResult = {
      buttons: Array<{ selector: string; text: string; role: string }>;
      components: Array<{ selector: string; text: string; role: string }>;
      modals: Array<{ selector: string; text: string; role: string }>;
      dropdowns: Array<{ selector: string; text: string; role: string }>;
      tables: Array<{ selector: string; text: string; role: string }>;
      forms: Array<{ selector: string; action: string; method: string; fields: string[] }>;
      links: string[];
    };

    const result: NodeResult = {
      buttons: [],
      components: [],
      modals: [],
      dropdowns: [],
      tables: [],
      forms: [],
      links: [],
    };

    const seenSelectors = new Set<string>();

    const buildSelector = (element: Element): string => {
      const htmlElement = element as HTMLElement;
      if (htmlElement.id) {
        return `#${htmlElement.id}`;
      }

      const dataTestId = htmlElement.getAttribute("data-testid");
      if (dataTestId) {
        return `[data-testid='${dataTestId}']`;
      }

      const className = htmlElement.className?.toString().trim();
      if (className) {
        const normalized = className
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => `.${part}`)
          .join("");
        if (normalized) {
          return `${htmlElement.tagName.toLowerCase()}${normalized}`;
        }
      }

      return htmlElement.tagName.toLowerCase();
    };

    const pushElement = (
      target: Array<{ selector: string; text: string; role: string }>,
      element: Element,
      fallbackRole: string,
    ) => {
      const selector = buildSelector(element);
      const key = `${fallbackRole}::${selector}`;
      if (seenSelectors.has(key)) {
        return;
      }

      seenSelectors.add(key);
      target.push({
        selector,
        text: (element.textContent || "").trim().slice(0, 160),
        role: element.getAttribute("role") || fallbackRole,
      });
    };

    const visitRoot = (root: ParentNode): void => {
      root.querySelectorAll("a[href]").forEach((link) => {
        const href = link.getAttribute("href") || "";
        if (href.startsWith("/") || href.startsWith("http")) {
          result.links.push(href);
        }
      });

      root.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit']").forEach((element) => {
        pushElement(result.buttons, element, "button");
      });

      root.querySelectorAll("[data-component], [data-testid], [role='tab'], [role='tabpanel']").forEach((element) => {
        pushElement(result.components, element, "component");
      });

      root.querySelectorAll("dialog, [role='dialog'], [aria-modal='true']").forEach((element) => {
        pushElement(result.modals, element, "dialog");
      });

      root.querySelectorAll("select, [role='listbox'], [role='menu'], [aria-haspopup='listbox']").forEach((element) => {
        pushElement(result.dropdowns, element, "dropdown");
      });

      root.querySelectorAll("table, [role='table'], [role='grid']").forEach((element) => {
        pushElement(result.tables, element, "table");
      });

      root.querySelectorAll("form").forEach((formElement) => {
        const selector = buildSelector(formElement);
        const fields = Array.from(formElement.querySelectorAll("input, textarea, select"))
          .map((field) => {
            const htmlField = field as HTMLElement;
            return htmlField.getAttribute("name") || htmlField.getAttribute("id") || htmlField.tagName.toLowerCase();
          })
          .filter(Boolean);

        result.forms.push({
          selector,
          action: formElement.getAttribute("action") || "",
          method: formElement.getAttribute("method") || "GET",
          fields,
        });
      });

      root.querySelectorAll("*").forEach((node) => {
        const element = node as HTMLElement;
        if (element.shadowRoot) {
          visitRoot(element.shadowRoot);
        }
      });
    };

    visitRoot(document);

    return {
      ...result,
      links: Array.from(new Set(result.links)),
    };
  });

  discovered.links.forEach((link) => registry.recordRoute(link));

  discovered.buttons.forEach((button) => {
    registry.recordButton({ route, selector: button.selector, text: button.text, role: button.role });
  });

  discovered.components.forEach((component) => {
    registry.recordComponent({ route, selector: component.selector, text: component.text, role: component.role });
  });

  discovered.modals.forEach((modal) => {
    registry.recordModal({ route, selector: modal.selector, text: modal.text, role: modal.role });
  });

  discovered.dropdowns.forEach((dropdown) => {
    registry.recordDropdown({ route, selector: dropdown.selector, text: dropdown.text, role: dropdown.role });
  });

  discovered.tables.forEach((table) => {
    registry.recordTable({ route, selector: table.selector, text: table.text, role: table.role });
  });

  discovered.forms.forEach((form) => {
    registry.recordForm({
      route,
      selector: form.selector,
      action: form.action,
      method: form.method,
      fieldCount: form.fields.length,
      fields: form.fields,
    });
  });
}
