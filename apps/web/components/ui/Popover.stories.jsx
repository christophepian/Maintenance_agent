import { Popover, PopoverTrigger, PopoverContent } from "./Popover";
import Button from "./Button";

export default {
  title: "UI/Popover",
  component: Popover,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
};

export const Default = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary">Actions ▾</Button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <div style={{ display: "flex", flexDirection: "column", padding: 6, minWidth: 160 }}>
          <button className="text-sm text-left px-3 py-2 rounded hover:bg-surface-hover">
            Edit
          </button>
          <button className="text-sm text-left px-3 py-2 rounded hover:bg-surface-hover">
            Duplicate
          </button>
          <button className="text-sm text-left px-3 py-2 rounded hover:bg-surface-hover text-destructive-text">
            Delete
          </button>
        </div>
      </PopoverContent>
    </Popover>
  ),
};
