import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import axios from "axios";
import PersonDetails from "./PersonDetails";

jest.mock("axios");

const person = {
  id: 2710,
  name: "James Cameron",
  canonical_slug: "james-cameron",
  known_for_department: "Directing",
  profile_path: "/james.jpg",
  movie_credits: [{ id: 679, title: "Aliens", release_date: "1986-07-18", poster_path: "/aliens.jpg", roles: ["Director"] }],
};

const LocationProbe = () => <div data-testid="location">{useLocation().pathname}</div>;

test("legacy person URLs canonicalize without breaking the filmography", async () => {
  axios.get.mockResolvedValue({ data: person });
  render(
    <MemoryRouter initialEntries={["/person/2710"]}>
      <Routes>
        <Route path="/person/:personId" element={<><PersonDetails /><LocationProbe /></>} />
        <Route path="/people/:personSlug" element={<><PersonDetails /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByRole("heading", { name: "James Cameron" })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/people/james-cameron"));
  expect(screen.getByRole("link", { name: "Open Aliens" })).toHaveAttribute("href", "/movies/aliens-1986");
});
