import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("is decorative and takes custom dimensions", () => {
    const { container } = render(<Skeleton width={120} height={16} />);
    const node = container.firstElementChild;
    expect(node).toHaveAttribute("aria-hidden", "true");
    expect(node).toHaveStyle({ width: "120px", height: "16px" });
  });
});
