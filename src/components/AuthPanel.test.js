import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AuthPanel from "./AuthPanel";
import { useAuth } from "../context/AuthContext";

jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));

const authDefaults = {
  user: null,
  loading: false,
  sendMagicLink: jest.fn(),
  signInWithPassword: jest.fn(),
  signUpWithPassword: jest.fn(),
  sendPasswordReset: jest.fn(),
  clearAuthError: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ ...authDefaults });
});

test("magic-link request exits loading and shows the destination address", async () => {
  const sendMagicLink = jest.fn().mockResolvedValue({ data: {} });
  useAuth.mockReturnValue({ ...authDefaults, sendMagicLink });
  render(<AuthPanel initialView="email-link" />);
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "viewer@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send sign-in link" }));
  expect(screen.getByRole("button", { name: "Sending link…" })).toBeDisabled();
  expect(await screen.findByText("Check your email")).toBeInTheDocument();
  expect(screen.getByText("We sent a sign-in link to viewer@example.com.")).toBeInTheDocument();
});

test("invalid password response exits loading with a useful error", async () => {
  const signInWithPassword = jest.fn().mockRejectedValue(new Error("Invalid login credentials"));
  useAuth.mockReturnValue({ ...authDefaults, signInWithPassword });
  render(<AuthPanel initialView="password-login" />);
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "viewer@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password1" } });
  const submitButton = screen.getAllByRole("button", { name: "Sign in" }).find((button) => button.type === "submit");
  fireEvent.click(submitButton);
  await waitFor(() => expect(submitButton).not.toBeDisabled());
  expect(screen.getByText("That email and password didn’t work.")).toBeInTheDocument();
});

test("uses sign in and create account as the primary tasks", () => {
  render(<AuthPanel initialView="password-login" />);

  expect(screen.getByRole("tab", { name: "Sign in" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tab", { name: "Create account" })).toHaveAttribute("aria-selected", "false");
  expect(screen.queryByRole("tab", { name: "Password" })).not.toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "Email sign-in" })).not.toBeInTheDocument();
});

test("creates an account with password confirmation and keeps the existing auth call", async () => {
  const signUpWithPassword = jest.fn().mockResolvedValue({ data: { session: { user: { email: "viewer@example.com" } } } });
  useAuth.mockReturnValue({ ...authDefaults, signUpWithPassword });
  render(<AuthPanel initialView="password-login" />);

  fireEvent.click(screen.getByRole("tab", { name: "Create account" }));
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "viewer@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password1" } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "password1" } });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));

  await waitFor(() => expect(signUpWithPassword).toHaveBeenCalledWith({ email: "viewer@example.com", password: "password1" }));
});

test("forgot password is a focused state and returns to sign in", () => {
  render(<AuthPanel initialView="password-login" />);
  fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));

  expect(screen.getByText("Reset your password")).toBeInTheDocument();
  expect(screen.getByText("Enter your email and we’ll send you a reset link.")).toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: "Create account" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
  expect(screen.getByRole("tab", { name: "Sign in" })).toBeInTheDocument();
});

test("email-link sign in is secondary and returns to password sign in", () => {
  render(<AuthPanel initialView="password-login" />);
  fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));

  expect(screen.getByText("Email me a sign-in link")).toBeInTheDocument();
  expect(screen.getByText("We’ll send a secure sign-in link to your email.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Back to password sign in" }));
  expect(screen.getByRole("tab", { name: "Sign in" })).toBeInTheDocument();
});

test("switching auth states clears the previous error", async () => {
  const signInWithPassword = jest.fn().mockRejectedValue(new Error("Invalid login credentials"));
  useAuth.mockReturnValue({ ...authDefaults, signInWithPassword });
  render(<AuthPanel initialView="password-login" />);
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "viewer@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password1" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in", selector: "button[type=submit]" }));
  expect(await screen.findByText("That email and password didn’t work.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Create account" }));
  expect(screen.queryByText("That email and password didn’t work.")).not.toBeInTheDocument();
});
