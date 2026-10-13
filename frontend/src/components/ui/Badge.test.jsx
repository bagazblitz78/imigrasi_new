import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EscalationBadge, RoleBadge, StatusBadge } from "./Badge";

describe("badges provide text, not colour alone", () => {
  it("renders passenger status labels", () => {
    render(<StatusBadge status="approved" />);
    expect(screen.getByText("Diizinkan")).toBeInTheDocument();
  });

  it("renders hold status", () => {
    render(<StatusBadge status="hold" />);
    expect(screen.getByText("Ditahan")).toBeInTheDocument();
  });

  it("renders escalation decisions", () => {
    render(<EscalationBadge decision="deported" />);
    expect(screen.getByText("Deportasi")).toBeInTheDocument();
  });

  it("renders roles", () => {
    render(<RoleBadge role="supervisor" />);
    expect(screen.getByText("Supervisor")).toBeInTheDocument();
  });
});
