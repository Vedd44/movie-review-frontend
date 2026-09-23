import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import AskReelbotLayer from "./AskReelbotLayer";
import useTasteProfile from "../hooks/useTasteProfile";
import { AskReelbotProvider, useAskReelbotPageContext } from "../context/AskReelbotContext";

jest.mock("axios");
jest.mock("../hooks/useTasteProfile");

function ContextRegistration({ context }) {
  useAskReelbotPageContext(context);
  return null;
}

beforeEach(() => {
  useTasteProfile.mockReturnValue({
    behavioralMemory: {},
    getPickExcludedIds: jest.fn(() => []),
    actions: { recordPickResult: jest.fn().mockResolvedValue() },
  });
  axios.post.mockResolvedValue({
    data: {
      kind: "answer",
      answer: "Sigourney Weaver stars in it.",
      intent: "GENERAL_INFORMATION_QUESTION",
      conversation_state: {
        lastUserMessage: "who stars in this?",
        lastAssistantMessage: "Sigourney Weaver stars in it.",
        pageContext: "general",
      },
    },
  });
});

test("clears Ask input after accepted submit while keeping the submitted message and response", async () => {
  render(<MemoryRouter><AskReelbotLayer /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: /Ask ReelBot/i }));

  const input = screen.getByRole("textbox", { name: "Ask ReelBot" });
  fireEvent.change(input, { target: { value: "who stars in this?" } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/reelbot/ask"),
    expect.objectContaining({
      prompt: "who stars in this?",
      conversation_state: expect.anything(),
    }),
    expect.anything()
  ));
  expect(input).toHaveValue("");
  expect(await screen.findByText("Sigourney Weaver stars in it.")).toBeInTheDocument();
});

test("does not clear an empty Ask submission", () => {
  render(<MemoryRouter><AskReelbotLayer /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: /Ask ReelBot/i }));

  const input = screen.getByRole("textbox", { name: "Ask ReelBot" });
  expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
  expect(input).toHaveValue("");
  expect(axios.post).not.toHaveBeenCalled();
});

test("movie-detail question chips submit movie questions through the active movie context", async () => {
  render(
    <MemoryRouter>
      <AskReelbotProvider>
        <ContextRegistration context={{ page: "movie_detail", movieId: 679, movieTitle: "Alien" }} />
        <AskReelbotLayer />
      </AskReelbotProvider>
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole("button", { name: /Ask ReelBot/i }));
  fireEvent.click(screen.getByRole("button", { name: "Is it scary?" }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/reelbot/ask"),
    expect.objectContaining({ prompt: "Is it scary?", page_context: expect.objectContaining({ movieId: 679 }) }),
    expect.anything()
  ));
});
