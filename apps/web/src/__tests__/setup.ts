import "@testing-library/react/pure";
import "@testing-library/jest-dom";
import { afterEach } from "vitest";

// Clean up after each test to prevent state leaks across tests
afterEach(() => {
  // Clear localStorage between tests
  if (typeof localStorage !== "undefined") {
    localStorage.clear();
  }
});
