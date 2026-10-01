import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";
import AskReelbotLayer, { normalizeAskFollowUps } from "./AskReelbotLayer";
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
  render(<MemoryRouter initialEntries={["/movies/aliens-1986"]}><AskReelbotProvider><ContextRegistration context={{ page: "movie_detail", movieId: 679, movieTitle: "Aliens" }} /><AskReelbotLayer /></AskReelbotProvider></MemoryRouter>);
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
  render(<MemoryRouter initialEntries={["/movies/aliens-1986"]}><AskReelbotProvider><ContextRegistration context={{ page: "movie_detail", movieId: 679, movieTitle: "Aliens" }} /><AskReelbotLayer /></AskReelbotProvider></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: /Ask ReelBot/i }));

  const input = screen.getByRole("textbox", { name: "Ask ReelBot" });
  expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
  expect(input).toHaveValue("");
  expect(axios.post).not.toHaveBeenCalled();
});

test("movie-detail question chips submit movie questions through the active movie context", async () => {
  render(
    <MemoryRouter initialEntries={["/movies/aliens-1986"]}>
      <AskReelbotProvider>
        <ContextRegistration context={{ page: "movie_detail", movieId: 679, movieTitle: "Alien" }} />
        <AskReelbotLayer />
      </AskReelbotProvider>
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole("button", { name: /Ask ReelBot/i }));
  fireEvent.click(screen.getByRole("button", { name: "How intense is it?" }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/reelbot/ask"),
    expect.objectContaining({ prompt: "How intense is it?", page_context: expect.objectContaining({ movieId: 679 }) }),
    expect.anything()
  ));
});

test("replaces starter chips with returned follow-ups and continues the conversation", async () => {
  axios.post
    .mockResolvedValueOnce({
      data: {
        kind: "answer",
        answer: "It is a good group option for older teens and adults.",
        follow_ups: ["What makes it R-rated?", "How violent is it?"],
        conversation_state: { anchorMovie: { id: 679, title: "Alien" }, lastUserMessage: "Is it good for a group?" },
      },
    })
    .mockResolvedValueOnce({
      data: {
        kind: "answer",
        answer: "The rating reflects sustained peril and violence.",
        follow_ups: ["Is it easy to follow?"],
        conversation_state: { anchorMovie: { id: 679, title: "Alien" }, lastUserMessage: "What makes it R-rated?" },
      },
    });

  render(
    <MemoryRouter initialEntries={["/movies/aliens-1986"]}>
      <AskReelbotProvider>
        <ContextRegistration context={{ page: "movie_detail", movieId: 679, movieTitle: "Alien" }} />
        <AskReelbotLayer />
      </AskReelbotProvider>
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole("button", { name: /Ask ReelBot/i }));
  expect(screen.getByRole("button", { name: "How intense is it?" })).toBeInTheDocument();

  const input = screen.getByRole("textbox", { name: "Ask ReelBot" });
  fireEvent.change(input, { target: { value: "Is it good for a group?" } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));

  expect(await screen.findByRole("button", { name: "What makes it R-rated?" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "How intense is it?" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "What makes it R-rated?" }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(2));
  expect(axios.post.mock.calls[1][1]).toEqual(expect.objectContaining({
    prompt: "What makes it R-rated?",
    page_context: expect.objectContaining({ movieId: 679 }),
  }));
  expect(await screen.findByRole("button", { name: "Is it easy to follow?" })).toBeInTheDocument();
  expect(screen.getByText("Is it good for a group?")).toBeInTheDocument();
  expect(screen.getByText("It is a good group option for older teens and adults.")).toBeInTheDocument();
  expect(screen.getByText("The rating reflects sustained peril and violence.")).toBeInTheDocument();
});

test("malformed follow-ups render no chips", () => {
  expect(normalizeAskFollowUps(null)).toEqual([]);
  expect(normalizeAskFollowUps(["", null, "  ", { text: "nope" }])).toEqual([]);
});


test("does not restore a generic homepage floating assistant",()=>{
  render(<MemoryRouter initialEntries={["/"]}><AskReelbotLayer/></MemoryRouter>);
  expect(screen.queryByRole("button",{name:/Ask ReelBot/i})).not.toBeInTheDocument();
});

test('closing Ask cancels the pending request and ignores a late answer', async () => {
  let finish;
  axios.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(<MemoryRouter initialEntries={['/movies/aliens-1986']}><AskReelbotProvider><ContextRegistration context={{ page: 'movie_detail', movieId: 679, movieTitle: 'Aliens' }} /><AskReelbotLayer /></AskReelbotProvider></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Ask ReelBot/i }));
  fireEvent.click(screen.getByRole('button', { name: 'How intense is it?' }));
  const signal = axios.post.mock.calls[0][2].signal;
  fireEvent.click(screen.getByRole('button', { name: 'Close Ask ReelBot' }));
  expect(signal.aborted).toBe(true);
  finish({ data: { kind: 'answer', answer: 'A stale answer' } });
  fireEvent.click(screen.getByRole('button', { name: /Ask ReelBot/i }));
  await waitFor(() => expect(screen.queryByText('A stale answer')).not.toBeInTheDocument());
});


test("a failed question can be retried without losing its text", async () => {
  axios.post.mockRejectedValueOnce(new Error("Connection interrupted"));
  render(<MemoryRouter initialEntries={["/movies/aliens-1986"]}><AskReelbotProvider><ContextRegistration context={{ page: "movie_detail", movieId: 679, movieTitle: "Aliens" }} /><AskReelbotLayer /></AskReelbotProvider></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: /Ask ReelBot/i }));
  fireEvent.change(screen.getByRole("textbox", { name: "Ask ReelBot" }), { target: { value: "Is it suitable for teens?" } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
  fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(2));
  expect(axios.post.mock.calls[1][1].prompt).toBe("Is it suitable for teens?");
  expect(await screen.findByText("Sigourney Weaver stars in it.")).toBeInTheDocument();
});
