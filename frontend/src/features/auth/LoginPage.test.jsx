import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../../contexts/AuthContext";
import LoginPage from "./LoginPage";

const loginMock = vi.fn();

vi.mock("../../api/client", () => ({
  refreshSession: vi.fn().mockRejectedValue(new Error("no session")),
  login: (...args) => loginMock(...args),
  logout: vi.fn(),
  setAccessToken: vi.fn(),
  setOnUnauthorized: vi.fn(),
  apiRequest: vi.fn(),
  api: { get: vi.fn(), post: vi.fn() },
}));

vi.mock("../../api/endpoints", () => ({
  authApi: { me: vi.fn(), changePassword: vi.fn() },
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it("renders the form and does not reveal whether a username exists", async () => {
    renderLogin();
    expect(await screen.findByText("Masuk ke Sistem")).toBeInTheDocument();
    expect(screen.queryByText(/username tidak ditemukan/i)).not.toBeInTheDocument();
  });

  it("submits credentials and reports backend errors generically", async () => {
    loginMock.mockRejectedValue(new Error("Username atau password salah"));
    const user = userEvent.setup();
    renderLogin();

    await user.type(await screen.findByLabelText(/^username/i), "admin");
    await user.type(screen.getByLabelText(/^password/i), "secret");
    await user.click(screen.getByRole("button", { name: /masuk/i }));

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith("admin", "secret"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Username atau password salah");
  });
});
