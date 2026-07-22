import KpiCard from "./KpiCard";

const accents = ["brand", "destructive", "success", "warning", "muted"];

export default {
  title: "UI/KpiCard",
  component: KpiCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  argTypes: {
    accent: { control: "select", options: accents },
    label: { control: "text" },
    value: { control: "text" },
    subtitle: { control: "text" },
  },
  args: {
    label: "Open Requests",
    value: "42",
    subtitle: "3 overdue",
    accent: "warning",
  },
};

export const Playground = {
  render: (args) => (
    <div style={{ width: 260 }}>
      <KpiCard {...args} />
    </div>
  ),
};

export const AccentGrid = {
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 240px)",
        gap: 12,
      }}
    >
      {accents.map((a) => (
        <KpiCard
          key={a}
          label={`Accent: ${a}`}
          value="1,240"
          subtitle="vs. last month"
          accent={a}
        />
      ))}
    </div>
  ),
};
