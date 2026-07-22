import Card from "./Card";
import Button from "./Button";
import Badge from "./Badge";

export default {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export const Basic = {
  render: () => (
    <Card style={{ width: 380 }}>
      <Card.Body>
        <p className="text-sm text-muted-dark">
          A plain surface card — rounded-2xl, surface-border, shadow-sm.
        </p>
      </Card.Body>
    </Card>
  ),
};

export const WithHeaderAndActions = {
  render: () => (
    <Card style={{ width: 420 }}>
      <Card.Header
        title="Building overview"
        actions={
          <>
            <Badge variant="success">Occupied</Badge>
            <Button size="sm" variant="secondary">
              Edit
            </Button>
          </>
        }
      />
      <Card.Body>
        <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
          <dt className="text-sm text-muted">Units</dt>
          <dd className="text-sm font-medium text-foreground">24</dd>
          <dt className="text-sm text-muted">Net operating income</dt>
          <dd className="text-sm font-medium text-foreground">CHF 412,000</dd>
        </dl>
      </Card.Body>
    </Card>
  ),
};
