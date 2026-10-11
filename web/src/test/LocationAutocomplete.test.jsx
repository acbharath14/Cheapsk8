import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import LocationAutocomplete from "../components/LocationAutocomplete";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

const nominatimResponse = [
  {
    lat: "38.9696", lon: "-77.3861",
    display_name: "Herndon, Fairfax County, Virginia, USA",
    address: { city: "Herndon", state: "Virginia", country_code: "us" },
  },
  {
    lat: "38.9", lon: "-77.3",
    display_name: "Herndon, Some County, Maryland, USA",
    address: { town: "Herndon", state: "Maryland", country_code: "us" },
  },
];

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

describe("LocationAutocomplete", () => {
  it("shows suggestions after typing 3+ chars (debounced)", async () => {
    mockFetch.mockResolvedValue({ json: async () => nominatimResponse });
    render(<LocationAutocomplete value="" onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText("Location");

    fireEvent.change(input, { target: { value: "hern" } });
    // Wait past the 350ms debounce.
    await delay(500);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain("q=hern");
    await waitFor(() => {
      expect(screen.getByText("Herndon, Virginia")).toBeInTheDocument();
    });
  }, 10000);

  it("does not fetch for short input", async () => {
    render(<LocationAutocomplete value="" onChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Location"), { target: { value: "he" } });
    await delay(500);
    expect(mockFetch).not.toHaveBeenCalled();
  }, 10000);

  it("selecting a suggestion calls onChange with formatted label", async () => {
    mockFetch.mockResolvedValue({ json: async () => nominatimResponse });
    const onChange = vi.fn();
    render(<LocationAutocomplete value="" onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText("Location"), { target: { value: "herndon" } });
    await delay(500);
    await waitFor(() => {
      expect(screen.getByText("Herndon, Virginia")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Herndon, Virginia"));
    expect(onChange).toHaveBeenCalledWith("Herndon, Virginia");
  }, 10000);

  it("formats town fallback when city is missing", async () => {
    mockFetch.mockResolvedValue({ json: async () => [nominatimResponse[1]] });
    render(<LocationAutocomplete value="" onChange={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("Location"), { target: { value: "herndon" } });
    await delay(500);
    await waitFor(() => {
      expect(screen.getByText("Herndon, Maryland")).toBeInTheDocument();
    });
  }, 10000);
});
