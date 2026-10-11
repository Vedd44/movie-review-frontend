import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { CollectionsIndex } from "./CollectionPage";
import { COLLECTIONS, COLLECTION_CATEGORIES } from "./collections";

function renderCollections(path = "/collections") {
  window.history.replaceState(null, "", path);
  return render(
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/collections" element={<CollectionsIndex />} />
        <Route path="/collections/:slug" element={<h1>Collection detail</h1>} />
      </Routes>
    </BrowserRouter>
  );
}

function expectCategory(category) {
  expect(screen.getByRole("button", { name: category })).toHaveAttribute("aria-pressed", "true");
  const expected = COLLECTIONS.filter((item) => category === "All" || item.categories?.includes(category));
  expect(screen.getByText(`${expected.length} collections`)).toBeInTheDocument();
  expect(screen.getAllByRole("link")).toHaveLength(expected.length);
  for (const item of expected) {
    expect(screen.getByRole("heading", { name: item.title })).toBeInTheDocument();
  }
}

async function traverseHistory(direction, expectedUrl) {
  await act(async () => {
    const popped = new Promise((resolve) => window.addEventListener("popstate", resolve, { once: true }));
    window.history[direction]();
    await popped;
  });
  await waitFor(() => expect(window.location.pathname + window.location.search).toBe(expectedUrl));
}

test("Back restores Seasonal after opening a collection, and Forward reopens the detail", async () => {
  renderCollections();
  expectCategory("All");
  fireEvent.click(screen.getByRole("button", { name: "Seasonal" }));
  expect(window.location.search).toBe("?category=seasonal");
  expectCategory("Seasonal");
  fireEvent.click(screen.getByRole("link", { name: /^Best Halloween Movies/ }));
  expect(screen.getByRole("heading", { name: "Collection detail" })).toBeInTheDocument();
  await traverseHistory("back", "/collections?category=seasonal");
  expectCategory("Seasonal");
  await traverseHistory("forward", "/collections/best-halloween-movies");
  expect(screen.getByRole("heading", { name: "Collection detail" })).toBeInTheDocument();
  await traverseHistory("back", "/collections?category=seasonal");
  expectCategory("Seasonal");
});

test("category changes and clearing are navigable, and repeated chips add no duplicate entries", async () => {
  renderCollections();
  fireEvent.click(screen.getByRole("button", { name: "Seasonal" }));
  fireEvent.click(screen.getByRole("button", { name: "Mood" }));
  expectCategory("Mood");
  expect(window.location.search).toBe("?category=mood");
  const length = window.history.length;
  fireEvent.click(screen.getByRole("button", { name: "Mood" }));
  expect(window.history.length).toBe(length);
  fireEvent.click(screen.getByRole("button", { name: "All" }));
  expectCategory("All");
  expect(window.location.search).toBe("");
  await traverseHistory("back", "/collections?category=mood");
  expectCategory("Mood");
  await traverseHistory("back", "/collections?category=seasonal");
  expectCategory("Seasonal");
  await traverseHistory("forward", "/collections?category=mood");
  expectCategory("Mood");
  await traverseHistory("forward", "/collections");
  expectCategory("All");
});

test.each(COLLECTION_CATEGORIES)("direct bookmarked URL restores %s, including after remount", (category) => {
  const path = `/collections?category=${category.toLowerCase()}`;
  const view = renderCollections(path);
  expectCategory(category);
  view.unmount();
  renderCollections(path);
  expectCategory(category);
});

test.each(["", "unknown", "SEASONAL", "%3Cscript%3E", "seasonal%20"])(
  "invalid or empty category %s falls back to All and can be cleared",
  (value) => {
    renderCollections(`/collections?category=${value}&source=test`);
    expectCategory("All");
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(window.location.search).toBe("?source=test");
    expectCategory("All");
  }
);

test("changing category preserves unrelated parameters without treating search text as a filter", () => {
  renderCollections("/collections?source=test&q=private+search");
  expectCategory("All");
  fireEvent.click(screen.getByRole("button", { name: "Genre" }));
  expect(window.location.search).toBe("?source=test&q=private+search&category=genre");
  expectCategory("Genre");
  // Detail links stay clean; no query text or category is sent to another route.
  for (const link of screen.getAllByRole("link")) expect(link.getAttribute("href")).not.toContain("?");
  fireEvent.click(screen.getByRole("button", { name: "All" }));
  expect(window.location.search).toBe("?source=test&q=private+search");
});
