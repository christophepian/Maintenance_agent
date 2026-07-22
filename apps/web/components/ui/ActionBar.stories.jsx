import ActionBar from "./ActionBar";
import Button from "./Button";

export default {
  title: "UI/ActionBar",
  component: ActionBar,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
};

export const Default = {
  render: () => (
    <div style={{ width: 480 }}>
      <ActionBar>
        <Button variant="primary">Save changes</Button>
        <Button variant="secondary">Cancel</Button>
        <Button variant="destructiveGhost">Delete</Button>
      </ActionBar>
    </div>
  ),
};
