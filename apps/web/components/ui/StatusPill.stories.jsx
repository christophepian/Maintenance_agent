import StatusPill from "./StatusPill";

const variants = [
  "default",
  "brand",
  "success",
  "destructive",
  "warning",
  "info",
  "muted",
  "orange",
];

export default {
  title: "UI/StatusPill",
  component: StatusPill,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: variants },
    size: { control: "inline-radio", options: ["sm", "md"] },
    children: { control: "text" },
  },
  args: { variant: "success", size: "md", children: "Active" },
};

export const Playground = {};

export const AllVariants = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {variants.map((v) => (
        <StatusPill key={v} variant={v}>
          {v}
        </StatusPill>
      ))}
    </div>
  ),
};
