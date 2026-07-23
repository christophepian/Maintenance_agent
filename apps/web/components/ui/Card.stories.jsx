import Card from "./Card";
import Button from "./Button";
import Badge from "./Badge";

export default {
  title: "UI/Card",
  component: Card,
  parameters: { layout: "padded" },
  subcomponents: { "Card.Header": Card.Header, "Card.Body": Card.Body },
};

/** A plain surface card — the base container. */
export const Basic = {
  render: () => (
    <Card style={{ width: 380 }}>
      <Card.Body>
        <p className="text-sm text-muted-dark">
          A plain surface card — <code>rounded-2xl</code>, <code>border-surface-border</code>,{" "}
          <code>bg-surface-raised</code>, <code>shadow-sm</code>.
        </p>
      </Card.Body>
    </Card>
  ),
};

/** Header (title + actions slot) over a body. Header stacks to a row at `sm`. */
export const WithHeaderAndActions = {
  render: () => (
    <Card style={{ width: 440 }}>
      <Card.Header
        title="Building overview"
        actions={
          <>
            <Badge variant="success">Occupied</Badge>
            <Button size="sm" variant="secondary">Edit</Button>
          </>
        }
      />
      <Card.Body>
        <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
          <dt className="text-sm text-muted">Units</dt>
          <dd className="text-sm font-medium text-foreground">24</dd>
          <dt className="text-sm text-muted">Net operating income</dt>
          <dd className="text-sm font-medium text-foreground">CHF 412,000</dd>
          <dt className="text-sm text-muted">Occupancy</dt>
          <dd className="text-sm font-medium text-foreground">93.6%</dd>
        </dl>
      </Card.Body>
    </Card>
  ),
};

/** Cards compose — several in a responsive grid. */
export const Grid = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, maxWidth: 760 }}>
      {[
        ["Rue du Rhône 12", "24 units", "success", "Occupied"],
        ["Avenue de la Gare 4", "12 units", "warning", "2 vacant"],
      ].map(([name, units, variant, status]) => (
        <Card key={name}>
          <Card.Header title={name} actions={<Badge variant={variant}>{status}</Badge>} />
          <Card.Body>
            <p className="text-sm text-muted">{units} · Geneva</p>
          </Card.Body>
        </Card>
      ))}
    </div>
  ),
};
