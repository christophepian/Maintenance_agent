import Input from "./Input";

export default {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  argTypes: {
    label: { control: "text" },
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
  },
  args: { label: "Tenant name", placeholder: "e.g. Dupont SA" },
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
};

export const Playground = {};

export const WithoutLabel = {
  args: { label: undefined, placeholder: "Search…" },
};

export const Disabled = {
  args: { disabled: true, placeholder: "Read only" },
};
