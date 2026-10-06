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
  fireEvent.click(screen.getByRole("button", { name: "Is it actually good?" }));

  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
    expect.stringContaining("/reelbot/ask"),
    expect.objectContaining({ prompt: "Is it actually good?", page_context: expect.objectContaining({ movieId: 679 }) }),
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
  expect(screen.getByRole("button", { name: "Is it actually good?" })).toBeInTheDocument();

  const input = screen.getByRole("textbox", { name: "Ask ReelBot" });
  fireEvent.change(input, { target: { value: "Is it good for a group?" } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));

  expect(await screen.findByRole("button", { name: "What makes it R-rated?" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Is it actually good?" })).not.toBeInTheDocument();
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
  fireEvent.click(screen.getByRole('button', { name: 'Is it actually good?' }));
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
  const retry = await screen.findByRole("button", { name: "Try again" });
  expect(screen.getByText("Is it suitable for teens?")).toBeInTheDocument();
  fireEvent.click(retry);
  await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(2));
  expect(axios.post.mock.calls[1][1].prompt).toBe("Is it suitable for teens?");
  expect(await screen.findByText("Sigourney Weaver stars in it.")).toBeInTheDocument();
});


test("Escape returns focus to the actual contextual launcher", async () => {
  render(<MemoryRouter initialEntries={["/movies/aliens-1986"]}><AskReelbotProvider><ContextRegistration context={{page:"movie_detail",movieId:679,movieTitle:"Aliens"}}/><button onClick={() => window.dispatchEvent(new CustomEvent("reelbot:open-ask"))}>Movie question</button><AskReelbotLayer/></AskReelbotProvider></MemoryRouter>);
  const launcher = screen.getByRole('button',{name:'Movie question'});
  launcher.focus(); fireEvent.click(launcher);
  await waitFor(() => expect(screen.getByRole('textbox',{name:'Ask ReelBot'})).toHaveFocus());
  fireEvent.keyDown(window,{key:'Escape'});
  await waitFor(() => expect(launcher).toHaveFocus());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});


test("can request a rewatch from a Watched-only library without requiring saved movies", async () => {
  render(<MemoryRouter initialEntries={["/my-movies"]}><AskReelbotProvider><ContextRegistration context={{page:"my_movies",savedMovieIds:[],watchedMovieIds:[2049]}}/><AskReelbotLayer/></AskReelbotProvider></MemoryRouter>);
  fireEvent(window, new CustomEvent("reelbot:open-ask"));
  fireEvent.change(screen.getByRole("textbox", {name:"Ask ReelBot"}), {target:{value:"Pick something to rewatch"}});
  fireEvent.click(screen.getByRole("button", {name:"Ask"}));
  await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/reelbot/ask"), expect.objectContaining({prompt:"Pick something to rewatch",page_context:expect.objectContaining({watchedMovieIds:[2049]})}), expect.anything()));
  expect(screen.queryByText(/Save a few movies first/)).not.toBeInTheDocument();
});

test('cast question does not return after two intervening answers and resets for a fresh panel', async () => {
  const data = (answer, follow_ups) => ({data:{kind:'answer',answer,follow_ups,conversation_state:{anchorMovie:{id:679,title:'Aliens'}}}});
  axios.post.mockResolvedValueOnce(data('The cast includes Sigourney Weaver.', ['Who directed it?']))
    .mockResolvedValueOnce(data('It is fictional.', ['Who directed it?']))
    .mockResolvedValueOnce(data('James Cameron directed it.', ['Who stars in it?', 'Who is in the cast?', 'Who directed it?', 'How long is it?']));
  render(<MemoryRouter initialEntries={['/movies/aliens-1986']}><AskReelbotProvider><ContextRegistration context={{page:'movie_detail',movieId:679,movieTitle:'Aliens'}}/><AskReelbotLayer/></AskReelbotProvider></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:/Ask ReelBot/i}));
  for (const [question,answer] of [['Who stars in it?','The cast includes Sigourney Weaver.'],['Is this based on a true story?','It is fictional.'],['Who directed it?','James Cameron directed it.']]) {
    fireEvent.change(screen.getByRole('textbox',{name:'Ask ReelBot'}),{target:{value:question}});
    fireEvent.click(screen.getByRole('button',{name:'Ask'}));
    await screen.findByText(answer);
  }
  expect(screen.queryByRole('button',{name:'Who stars in it?'})).toBeNull();
  expect(screen.queryByRole('button',{name:'Who is in the cast?'})).toBeNull();
  expect(screen.queryByRole('button',{name:'Who directed it?'})).toBeNull();
  expect(screen.getByRole('button',{name:'How long is it?'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Close Ask ReelBot'}));
  fireEvent.click(screen.getByRole('button',{name:/Ask ReelBot/i}));
  axios.post.mockResolvedValueOnce(data('A fresh answer.', ['Who stars in it?']));
  fireEvent.change(screen.getByRole('textbox',{name:'Ask ReelBot'}),{target:{value:'Is it good?'}});
  fireEvent.click(screen.getByRole('button',{name:'Ask'}));
  expect(await screen.findByRole('button',{name:'Who stars in it?'})).toBeInTheDocument();
});
