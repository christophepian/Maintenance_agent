import Input from "./Input";

const label = { fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 };
const Cell = ({ title, children }) => (
  <div style={{ width: 240 }}>
    <div style={label}>{title}</div>
    {children}
  </div>
);

export default {
  title: "UI/Input",
  component: Input,
  parameters: { layout: "padded" },
  argTypes: {
    label: { control: "text", description: "Optional label above the field (renders .filter-label)." },
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
  },
  args: { label: "Tenant name", placeholder: "e.g. Dupont SA" },
};

/** Interactive — a labelled text field. */
export const Playground = {
  render: (args) => (
    <div style={{ width: 280 }}>
      <Input {...args} />
    </div>
  ),
};

/** States. Note: `.filter-input` has no custom focus ring today — focus falls back
 * to the browser default (see the Accessibility notes in Docs). Error styling is
 * composed by overriding the border + adding a message. */
export const States = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 240px)", gap: 24 }}>
      <Cell title="default">
        <Input label="Tenant name" placeholder="e.g. Dupont SA" />
      </Cell>
      <Cell title="filled">
        <Input label="Tenant name" defaultValue="Dupont SA" />
      </Cell>
      <Cell title="disabled">
        <Input label="Tenant name" placeholder="Read only" disabled />
      </Cell>
      <Cell title="error">
        <Input label="Tenant name" defaultValue="" placeholder="Required" className="!border-destructive-ring" aria-invalid="true" />
        <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 4 }}>Tenant name is required.</div>
      </Cell>
    </div>
  ),
};

/** Without a label — e.g. a search field. */
export const NoLabel = {
  render: () => (
    <div style={{ width: 280 }}>
      <Input placeholder="Search tenants…" />
    </div>
  ),
};

/** In context — a filter row. */
export const InContext = {
  render: () => (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
      <Input label="Search" placeholder="Address or tenant" wrapperClassName="w-56" />
      <Input label="Min rent" placeholder="CHF" wrapperClassName="w-28" />
      <Input label="Max rent" placeholder="CHF" wrapperClassName="w-28" />
    </div>
  ),
};
