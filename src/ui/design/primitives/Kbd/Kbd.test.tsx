import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Kbd } from "./Kbd";

describe("Kbd", () => {
  it("renders a semantic keyboard hint", () => {
    render(<Kbd>Ctrl</Kbd>);
    expect(screen.getByText("Ctrl").tagName).toBe("KBD");
  });
});
