import Button from "./Button";

const variants = [
  "primary",
  "secondary",
  "destructive",
  "destructiveGhost",
  "success",
  "warning",
  "warningGhost",
  "neutral",
  "ghost",
  "link",
];
const sizes = ["xs", "sm", "md", "lg"];

export default {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: variants },
    size: { control: "inline-radio", options: sizes },
    children: { control: "text" },
    disabled: { control: "boolean" },
  },
  args: { variant: "primary", size: "md", children: "Save changes" },
};

export const Playground = {};

export const AllVariants = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, maxWidth: 680 }}>
      {variants.map((v) => (
        <Button key={v} variant={v}>
          {v}
        </Button>
      ))}
    </div>
  ),
};

export const Sizes = {
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {sizes.map((s) => (
        <Button key={s} size={s}>
          Size {s}
        </Button>
      ))}
    </div>
  ),
};

export const Disabled = {
  args: { disabled: true, children: "Disabled" },
};
