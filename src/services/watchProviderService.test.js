import axios from "axios";
import { fetchWatchProviderMap } from "./watchProviderService";
jest.mock("axios");
test("simultaneous consumers share provider requests and do not cache failed items as empty", async () => {
  let resolve;
  axios.get.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const first = fetchWatchProviderMap([101, 102]);
  const second = fetchWatchProviderMap([102]);
  expect(axios.get).toHaveBeenCalledTimes(1);
  resolve({
    data: { results: [{ id: 101, provider_badges: [{ name: "Provider" }] }] },
  });
  await Promise.all([first, second]);
  axios.get.mockResolvedValue({
    data: { results: [{ id: 102, provider_badges: [] }] },
  });
  await fetchWatchProviderMap([101, 102]);
  expect(axios.get).toHaveBeenCalledTimes(2);
  expect(axios.get.mock.calls[1][1].params.ids).toBe("102");
});
