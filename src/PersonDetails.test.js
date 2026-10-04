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

test('a missing portrait and biography do not block a one-film filmography', async () => {
  axios.get.mockResolvedValue({data:{...person,profile_path:null,biography:''}});
  render(<MemoryRouter initialEntries={['/people/james-cameron']}><Routes><Route path="/people/:personSlug" element={<PersonDetails/>}/></Routes></MemoryRouter>);
  expect(await screen.findByRole('heading',{name:'James Cameron'})).toBeInTheDocument();
  expect(screen.getByRole('img',{name:'Artwork unavailable'})).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Read biography'})).not.toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Open Aliens'})).toBeInTheDocument();
});

test('character job titles do not count as crew roles, while genuine mixed credits remain', async () => {
  axios.get.mockResolvedValue({data:{...person,name:'Steven Spielberg',canonical_slug:'steven-spielberg',movie_credits:[
    {id:817,title:'Austin Powers in Goldmember',release_date:'2002-07-26',roles:["Actor: Steven Spielberg / Famous Director ('Austinpussy')"]},
    {id:100,title:'Acting Cameo',release_date:'2000-01-01',roles:['Actor: Producer and Screenwriter']},
    {id:101,title:'War Horse',release_date:'2011-12-25',roles:['Director','Producer']},
    {id:102,title:'Acts and Directs',release_date:'2001-01-01',roles:['Actor: Director','Director']},
    {id:103,title:'Written Film',release_date:'2001-01-01',roles:['Screenplay']},
    {id:104,title:'Assistant Credit',release_date:'2001-01-01',roles:['First Assistant Director']},
  ]}});
  render(<MemoryRouter initialEntries={['/people/steven-spielberg']}><Routes><Route path="/people/:personSlug" element={<PersonDetails/>}/></Routes></MemoryRouter>);
  const role=await screen.findByRole('combobox',{name:'Filter by role'});
  fireEvent.change(role,{target:{value:'Director'}});
  expect(screen.queryByRole('link',{name:'Open Austin Powers in Goldmember'})).not.toBeInTheDocument();
  expect(screen.queryByRole('link',{name:'Open Assistant Credit'})).not.toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Open War Horse'})).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Open Acts and Directs'})).toBeInTheDocument();
  fireEvent.change(role,{target:{value:'Actor'}});
  expect(screen.getByRole('link',{name:'Open Austin Powers in Goldmember'})).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Open Acts and Directs'})).toBeInTheDocument();
  fireEvent.change(role,{target:{value:'Producer'}});
  expect(screen.getByRole('link',{name:'Open War Horse'})).toBeInTheDocument();
  expect(screen.queryByRole('link',{name:'Open Acting Cameo'})).not.toBeInTheDocument();
  fireEvent.change(role,{target:{value:'Writer'}});
  expect(screen.getByRole('link',{name:'Open Written Film'})).toBeInTheDocument();
  expect(screen.queryByRole('link',{name:'Open Acting Cameo'})).not.toBeInTheDocument();
});
