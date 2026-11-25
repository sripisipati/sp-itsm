import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { SummaryCards } from "./SummaryCards";
import { theme } from "../../../theme/theme";

describe("SummaryCards", () => {
  it("renders database-backed counts", () => {
    render(
      <ThemeProvider theme={theme}>
        <SummaryCards total={32} open={18} inProgress={7} resolved={5} />
      </ThemeProvider>,
    );
    expect(screen.getByText("Total Incidents")).toBeInTheDocument();
    expect(screen.getByText("32")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
  });
});
