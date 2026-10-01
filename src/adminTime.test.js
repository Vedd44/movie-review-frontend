import { adminTimeAgo, formatAdminDate, parseAdminDate } from "./adminTime";

test("legacy UTC database timestamps resolve to the same instant as explicit offsets", () => {
  const expected = "2026-10-01T19:11:00.000Z";
  for (const value of ["2026-10-01T19:11:00", "2026-10-01 19:11:00", "2026-10-01T19:11:00Z", "2026-10-01T15:11:00-04:00"]) {
    expect(parseAdminDate(value).toISOString()).toBe(expected);
  }
});

test("missing, invalid, and future timestamps do not crash or pretend to be recent activity", () => {
  expect(formatAdminDate("not a date")).toBe("—");
  expect(formatAdminDate(null)).toBe("—");
  expect(adminTimeAgo(null)).toBe("Never");
  expect(adminTimeAgo(new Date(Date.now() + 3600000).toISOString())).toBe("Future timestamp");
  expect(adminTimeAgo(new Date(Date.now() - 300000).toISOString())).toBe("5m ago");
});
