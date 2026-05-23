/**
 * Integration tests for the LoginPage component.
 *
 * The Zustand store and router are mocked so no real network calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockLogin = vi.fn();
const mockPush = vi.fn();

vi.mock("@/lib/store", () => ({
  useAuthStore: (selector: (s: { login: typeof mockLogin }) => unknown) =>
    selector({ login: mockLogin }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// next/link renders an <a> tag in tests
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

// ─── Component under test ─────────────────────────────────────────────────────

// Lazy import after mocks
const { default: LoginPage } = await import("@/app/login/page");

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email and password fields", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("renders a sign-in button", () => {
    render(<LoginPage />);
    expect(
      screen.getByRole("button", { name: /sign in|log in/i })
    ).toBeInTheDocument();
  });

  it("calls login with entered credentials on submit", async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText(/email/i), "alice@forge.dev");
    await userEvent.type(screen.getByLabelText(/password/i), "password123");
    fireEvent.click(screen.getByRole("button", { name: /sign in|log in/i }));

    await waitFor(() =>
      expect(mockLogin).toHaveBeenCalledWith("alice@forge.dev", "password123")
    );
  });

  it("redirects to /app on successful login", async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText(/email/i), "alice@forge.dev");
    await userEvent.type(screen.getByLabelText(/password/i), "pass");
    fireEvent.click(screen.getByRole("button", { name: /sign in|log in/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/app"));
  });

  it("shows an error message on failed login", async () => {
    const { ApiError } = await import("@/lib/api");
    mockLogin.mockRejectedValueOnce(new ApiError(401, "Invalid credentials"));
    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText(/email/i), "bad@forge.dev");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong");
    fireEvent.click(screen.getByRole("button", { name: /sign in|log in/i }));

    await waitFor(() =>
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    );
  });

  it("disables the button while loading", async () => {
    // Delay resolution so we can check the loading state
    mockLogin.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 500))
    );
    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText(/email/i), "alice@forge.dev");
    await userEvent.type(screen.getByLabelText(/password/i), "pass");
    const button = screen.getByRole("button", { name: /sign in|log in/i });
    fireEvent.click(button);

    expect(button).toBeDisabled();
  });

  it("has a link to the register page", () => {
    render(<LoginPage />);
    const registerLink = screen.getByRole("link", { name: /sign up|register|create account/i });
    expect(registerLink).toBeInTheDocument();
  });
});
