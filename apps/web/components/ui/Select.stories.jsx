import Select from "./Select";

export default {
  title: "UI/Select",
  component: Select,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  argTypes: {
    label: { control: "text" },
    placeholder: { control: "text" },
  },
  args: {
    label: "Building",
    placeholder: "Choose a building…",
    options: ["Rue du Rhône 12", "Avenue de la Gare 4", "Chemin Vert 8"],
  },
  decorators: [
    (Story) => (
      <div style={{ width: 260 }}>
        <Story />
      </div>
    ),
  ],
};

export const Playground = {};

export const ObjectOptions = {
  args: {
    label: "Status",
    placeholder: undefined,
    options: [
      { value: "active", label: "Active" },
      { value: "pending", label: "Pending" },
      { value: "archived", label: "Archived" },
    ],
  },
};
