import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VisuallyHidden } from "./VisuallyHidden";

describe("VisuallyHidden", () => {
  it("keeps content available to assistive technology", () => {
    render(<VisuallyHidden>3 observations</VisuallyHidden>);
    expect(screen.getByText("3 observations")).toBeInTheDocument();
  });
});
