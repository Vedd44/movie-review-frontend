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
  expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
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
