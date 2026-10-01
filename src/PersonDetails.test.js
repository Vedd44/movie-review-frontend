import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

test('writer filter includes screenplay credits and exposes its selected state', async () => {
  axios.get.mockResolvedValue({data:{...person,movie_credits:[...person.movie_credits,{id:680,title:'A Screenplay',release_date:'1990-01-01',roles:['Screenplay']}]}});
  render(<MemoryRouter initialEntries={['/people/james-cameron']}><Routes><Route path="/people/:personSlug" element={<PersonDetails/>}/></Routes></MemoryRouter>);
  const writer=await screen.findByRole('combobox',{name:'Filter by role'});
  fireEvent.change(writer, {target:{value:'Writer'}});
  expect(writer).toHaveValue('Writer');
  expect(screen.getByRole('link',{name:'Open A Screenplay'})).toBeInTheDocument();
  expect(screen.queryByRole('link',{name:'Open Aliens'})).not.toBeInTheDocument();
});

test('most rated puts established films ahead of recent low-vote credits', async () => {
  axios.get.mockResolvedValue({data:{...person,movie_credits:[
    {...person.movie_credits[0],vote_count:9000},
    {id:680,title:'Recent Movie',release_date:'2026-01-01',vote_count:10,roles:['Director']},
  ]}});
  render(<MemoryRouter initialEntries={['/people/james-cameron']}><Routes><Route path="/people/:personSlug" element={<PersonDetails/>}/></Routes></MemoryRouter>);
  expect(await screen.findByRole('combobox',{name:'Sort filmography'})).toHaveValue('popular');
  expect(screen.getAllByRole('heading',{level:3}).map(e=>e.textContent)).toEqual(['Aliens','Recent Movie']);
});
