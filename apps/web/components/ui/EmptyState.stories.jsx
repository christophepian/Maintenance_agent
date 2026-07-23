import EmptyState from "./EmptyState";
import Button from "./Button";

export default {
  title: "UI/EmptyState",
  component: EmptyState,
  parameters: { layout: "padded" },
  args: {
    icon: "📭",
    title: "No maintenance requests",
    message: "When tenants submit requests, they'll appear here.",
  },
};

export const Playground = {
  render: (args) => (
    <div style={{ width: 420, border: "1px dashed #e2e8f0", borderRadius: 16 }}>
      <EmptyState {...args} />
    </div>
  ),
};

export const WithAction = {
  render: (args) => (
    <div style={{ width: 420, border: "1px dashed #e2e8f0", borderRadius: 16 }}>
      <EmptyState {...args}>
        <Button size="sm" style={{ marginTop: 12 }}>
          New request
        </Button>
      </EmptyState>
    </div>
  ),
};
