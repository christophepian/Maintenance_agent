import Select from "./Select";

const buildings = ["Rue du Rhône 12", "Avenue de la Gare 4", "Chemin Vert 8"];
const label = { fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 };
const Cell = ({ title, children }) => (
  <div style={{ width: 220 }}>
    <div style={label}>{title}</div>
    {children}
  </div>
);

export default {
  title: "UI/Select",
  component: Select,
  parameters: { layout: "padded" },
  argTypes: {
    label: { control: "text" },
    placeholder: { control: "text" },
    options: { control: "object", description: "Array of strings or { value, label } objects." },
  },
  args: { label: "Building", placeholder: "Choose a building…", options: buildings },
};

/** Interactive — a labelled dropdown. */
export const Playground = {
  render: (args) => (
    <div style={{ width: 240 }}>
      <Select {...args} />
    </div>
  ),
};

/** States. `.filter-select` shares its border/radius with Input. */
export const States = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 220px)", gap: 24 }}>
      <Cell title="placeholder">
        <Select label="Building" placeholder="Choose a building…" options={buildings} />
      </Cell>
      <Cell title="selected">
        <Select label="Building" options={buildings} defaultValue="Avenue de la Gare 4" />
      </Cell>
      <Cell title="disabled">
        <Select label="Building" placeholder="Locked" options={buildings} disabled />
      </Cell>
    </div>
  ),
};

/** Object options — `{ value, label }` when the stored value differs from the label. */
export const ObjectOptions = {
  render: () => (
    <div style={{ width: 240 }}>
      <Select
        label="Status"
        placeholder="Any status"
        options={[
          { value: "active", label: "Active" },
          { value: "pending", label: "Pending" },
          { value: "archived", label: "Archived" },
        ]}
      />
    </div>
  ),
};

/** In context — a filter row beside inputs. */
export const InContext = {
  render: () => (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
      <Select label="Building" placeholder="All buildings" options={buildings} />
      <Select label="Status" placeholder="Any" options={["Active", "Pending", "Archived"]} />
    </div>
  ),
};
