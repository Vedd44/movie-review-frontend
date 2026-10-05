import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import axios from "axios";
import GlobalMovieSearch from "./GlobalMovieSearch";
jest.mock("axios");
const Probe = () => <span data-testid="route">{useLocation().pathname}</span>;
function open() {
  render(
    <MemoryRouter>
      <GlobalMovieSearch />
      <Probe />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Search movies" }));
  return screen.getByRole("combobox");
}
beforeEach(() => jest.clearAllMocks());
test("search escapes the header containing block and restores keyboard focus", async () => {
  render(<MemoryRouter><header style={{backdropFilter: "blur(12px)"}}><GlobalMovieSearch /></header></MemoryRouter>);
  const trigger = screen.getByRole("button", { name: "Search movies" });
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Search movies & people" });
  expect(dialog.closest("header")).toBeNull();
  expect(dialog.parentElement.parentElement).toBe(document.body);
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
test("partial person results work with keyboard selection", async () => {
  axios.get.mockResolvedValue({
    data: {
      results: [
        {
          id: 10297,
          name: "Matthew McConaughey",
          known_for_department: "Acting",
          media_type: "person",
        },
      ],
    },
  });
  const input = open();
  fireEvent.change(input, { target: { value: "Matthew McCon" } });
  expect(
    await screen.findByRole("option", { name: /Matthew McConaughey/ }),
  ).toBeInTheDocument();
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(screen.getByTestId("route")).toHaveTextContent("/person/10297");
});
test("late results from a previous query never replace the current query", async () => {
  let oldResolve;
  axios.get
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          oldResolve = resolve;
        }),
    )
    .mockResolvedValueOnce({
      data: {
        results: [
          {
            id: 157336,
            title: "Interstellar",
            release_date: "2014-11-05",
            media_type: "movie",
          },
        ],
      },
    });
  const input = open();
  fireEvent.change(input, { target: { value: "Matthew" } });
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
  fireEvent.change(input, { target: { value: "Interstel" } });
  expect(
    screen.queryByText("No matching movies or people."),
  ).not.toBeInTheDocument();
  expect(
    await screen.findByRole("option", { name: /Interstellar/ }),
  ).toBeInTheDocument();
  await act(async () =>
    oldResolve({
      data: { results: [{ id: 1, name: "Matthew", media_type: "person" }] },
    }),
  );
  expect(
    screen.queryByRole("option", { name: /Matthew/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("option", { name: /Interstellar/ }),
  ).toBeInTheDocument();
});
