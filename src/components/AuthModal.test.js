import { fireEvent, render, screen } from "@testing-library/react";
import AuthModal from "./AuthModal";
import { useAuth } from "../context/AuthContext";

jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));

test("opens on password sign in with task-first navigation and concise value proposition", () => {
  const closeAuthPrompt = jest.fn();
  useAuth.mockReturnValue({ authPromptOpen: true, closeAuthPrompt });
  render(<AuthModal />);

  expect(screen.getByRole("heading", { name: "Make ReelBot yours." })).toBeInTheDocument();
  expect(screen.getByText("Save movies, remember what you’ve watched, and get better picks over time.")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Sign in" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tab", { name: "Create account" })).toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "Password" })).not.toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "Email sign-in" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Close sign in dialog" }));
  expect(closeAuthPrompt).toHaveBeenCalled();
});
