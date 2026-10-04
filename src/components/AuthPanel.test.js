import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AuthPanel from "./AuthPanel";
import { useAuth } from "../context/AuthContext";
import { getAuthProviders } from "../lib/supabaseClient";

jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../lib/supabaseClient", () => ({ getAuthProviders: jest.fn() }));

const authDefaults = {
  user: null,
  loading: false,
  sendMagicLink: jest.fn(),
  signInWithPassword: jest.fn(),
  signUpWithPassword: jest.fn(),
  sendPasswordReset: jest.fn(),
  clearAuthError: jest.fn(),
  clearAuthNotice: jest.fn(),
  resendConfirmation: jest.fn(),
  signInWithGoogle: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  getAuthProviders.mockResolvedValue({ google: false });
  useAuth.mockReturnValue({ ...authDefaults });
});

test("confirmation names the destination and resends only after the cooldown", async () => {
  jest.useFakeTimers();
  const resendConfirmation = jest.fn().mockResolvedValue({});
  useAuth.mockReturnValue({ ...authDefaults, resendConfirmation, signUpWithPassword: jest.fn().mockResolvedValue({ data: { session: null } }) });
  render(<AuthPanel initialView="password-signup" />);
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "viewer@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password1" } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "password1" } });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  expect(await screen.findByText("Confirm your email using the link sent to viewer@example.com.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Resend available in 60s" })).toBeDisabled();
  for (let i = 0; i < 60; i++) await act(async () => { jest.advanceTimersByTime(1000); });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Resend confirmation email" })); });
  await waitFor(() => expect(resendConfirmation).toHaveBeenCalledWith("viewer@example.com"));
  expect(await screen.findByText("A new confirmation link is on the way to viewer@example.com.")).toBeInTheDocument();
  jest.useRealTimers();
});

test("unconfirmed login offers a confirmation resend", async () => {
  const resendConfirmation = jest.fn().mockResolvedValue({});
  useAuth.mockReturnValue({ ...authDefaults, resendConfirmation, signInWithPassword: jest.fn().mockRejectedValue({ code: "email_not_confirmed", message: "Email not confirmed" }) });
  render(<AuthPanel />);
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "viewer@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password1" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  fireEvent.click(await screen.findByRole("button", { name: "Resend confirmation email" }));
  await waitFor(() => expect(resendConfirmation).toHaveBeenCalledWith("viewer@example.com"));
  expect(await screen.findByText("A new confirmation link is on the way to viewer@example.com.")).toBeInTheDocument();
});

test("Google is shown only for an enabled provider and failures keep email usable", async () => {
  getAuthProviders.mockResolvedValue({ google: true });
  const signInWithGoogle = jest.fn().mockRejectedValue(new Error("Provider unavailable"));
  useAuth.mockReturnValue({ ...authDefaults, signInWithGoogle });
  render(<AuthPanel />);
  fireEvent.click(await screen.findByRole("button", { name: "Continue with Google" }));
  expect(await screen.findByText("We couldn’t open Google sign-in. Try again or use email.")).toBeInTheDocument();
  expect(screen.getByLabelText("Email address")).not.toBeDisabled();
});

test("rate limits receive actionable guidance", async () => {
  useAuth.mockReturnValue({ ...authDefaults, sendPasswordReset: jest.fn().mockRejectedValue({ code: "over_email_send_rate_limit" }) });
  render(<AuthPanel initialView="forgot-password" />);
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "viewer@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
  expect(await screen.findByText("Please wait a minute before trying again.")).toBeInTheDocument();
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
  expect(screen.getByText("Incorrect email or password.")).toBeInTheDocument();
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
  expect(await screen.findByText("Incorrect email or password.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Create account" }));
  expect(screen.queryByText("Incorrect email or password.")).not.toBeInTheDocument();
});

test('sign in accepts an existing password without applying new-account strength rules',async()=>{
  const signInWithPassword=jest.fn().mockResolvedValue({});
  useAuth.mockReturnValue({...authDefaults,signInWithPassword});
  render(<AuthPanel initialView="password-login"/>);
  fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'viewer@example.com'}});
  fireEvent.change(screen.getByLabelText('Password'),{target:{value:'existing-password'}});
  fireEvent.click(screen.getByRole('button',{name:'Sign in'}));
  await waitFor(()=>expect(signInWithPassword).toHaveBeenCalledWith({email:'viewer@example.com',password:'existing-password'}));
});
