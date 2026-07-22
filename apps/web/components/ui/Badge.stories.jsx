import Badge from "./Badge";

const variants = [
  "default",
  "brand",
  "success",
  "destructive",
  "warning",
  "info",
  "muted",
];
const sizes = ["sm", "md", "lg"];

export default {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: variants },
    size: { control: "inline-radio", options: sizes },
    children: { control: "text" },
  },
  args: { variant: "brand", size: "md", children: "Badge" },
};

export const Playground = {};

export const AllVariants = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {variants.map((v) => (
        <Badge key={v} variant={v}>
          {v}
        </Badge>
      ))}
    </div>
  ),
};

export const Sizes = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {sizes.map((s) => (
        <Badge key={s} variant="brand" size={s}>
          {s}
        </Badge>
      ))}
    </div>
  ),
};
