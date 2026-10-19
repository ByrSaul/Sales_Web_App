import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardHighlightCard } from "./DashboardHighlightCard";
import { DashboardMetricCard } from "./DashboardMetricCard";

afterEach(cleanup);
describe.each(["highlight", "metric"])("Dashboard %s card", (kind) => {
  const mount = (loading: boolean, error: boolean, value?: number) =>
    render(
      kind === "highlight" ? (
        <DashboardHighlightCard
          loading={loading}
          error={error}
          value={value}
          onOpen={() => undefined}
        />
      ) : (
        <DashboardMetricCard
          label="Clientes"
          icon="group"
          loading={loading}
          error={error}
          value={value}
        />
      ),
    );

  it("gives loading priority over an error and a cached value", () => {
    const { container } = mount(true, true, 12);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(screen.queryByText("No disponible")).not.toBeInTheDocument();
    expect(screen.queryByText("12")).not.toBeInTheDocument();
  });

  it.each(["error", "absent"])("shows unavailable data for %s", (state) => {
    const { container } = mount(
      false,
      state === "error",
      state === "error" ? 12 : undefined,
    );
    expect(screen.getByText("No disponible")).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).not.toBeInTheDocument();
    expect(screen.queryByText("12")).not.toBeInTheDocument();
  });

  it("shows a real zero value", () => {
    mount(false, false, 0);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByText("No disponible")).not.toBeInTheDocument();
  });
});

it("opens the assigned customers through the highlight action", () => {
  const open = vi.fn();
  render(
    <DashboardHighlightCard
      loading={false}
      error={false}
      value={12}
      onOpen={open}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Ver mis clientes" }));
  expect(open).toHaveBeenCalledTimes(1);
});

it("keeps the secondary metric accent on a successful value", () => {
  render(
    <DashboardMetricCard
      label="Pedidos"
      icon="receipt"
      loading={false}
      error={false}
      value={7}
      accent="secondary"
    />,
  );
  expect(screen.getByText("7")).toHaveClass("text-secondary");
});
