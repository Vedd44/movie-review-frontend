import { normalizePickPayload } from "./reelbotSession";

const buildMovie = (id, title, releaseDate) => ({
  id,
  title,
  release_date: releaseDate,
});

describe("normalizePickPayload", () => {
  it("keeps explicit decade prompts inside the requested release range", () => {
    const payload = normalizePickPayload({
      primary: buildMovie(1, "Modern Miss", "2025-07-18"),
      alternates: [
        buildMovie(2, "Point Break", "1991-07-12"),
        buildMovie(3, "Heat", "1995-12-15"),
      ],
      resolved_preferences: {
        prompt: "90s action movie",
      },
    });

    expect(payload.primary.title).toBe("Point Break");
    expect(payload.alternates.map((movie) => movie.title)).toEqual(["Heat"]);
  });

  it("returns null when no strict-era candidates survive", () => {
    const payload = normalizePickPayload({
      primary: buildMovie(1, "Modern Miss", "2025-07-18"),
      alternates: [buildMovie(2, "Another Miss", "2005-06-10")],
      resolved_preferences: {
        prompt: "90s action movie",
      },
    });

    expect(payload).toBeNull();
  });

  it("allows narrow fallback only when the payload marks relaxed time constraints", () => {
    const payload = normalizePickPayload({
      primary: buildMovie(1, "Close Enough", "2001-06-08"),
      alternates: [buildMovie(2, "Too New", "2025-07-18")],
      resolved_preferences: {
        prompt: "90s action movie",
      },
      resolved_intent: {
        time_constraint_state: {
          relaxed: true,
          range: {
            min_year: 1988,
            max_year: 2001,
          },
          original_range: {
            min_year: 1990,
            max_year: 1999,
          },
        },
      },
    });

    expect(payload.primary.title).toBe("Close Enough");
    expect(payload.alternates).toEqual([]);
  });
});
