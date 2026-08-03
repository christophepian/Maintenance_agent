import { useState } from "react";
import { Dialog, DialogTrigger, DialogContent, DialogHeader } from "./Dialog";
import Button from "./Button";
import { ModalFooter } from "./Modal";

export default {
  title: "UI/Dialog",
  component: Dialog,
  parameters: { layout: "centered" },
};

function DialogDemo({ startOpen = false }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button>Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader title="Confirm lease termination" />
        <div style={{ padding: 24 }}>
          <p className="text-sm text-muted-dark">
            This will end the lease and stop all recurring rent invoices. This
            action cannot be undone.
          </p>
        </div>
        <div style={{ padding: "0 24px 20px" }}>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => setOpen(false)}>
              Terminate lease
            </Button>
          </ModalFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const Default = { render: () => <DialogDemo /> };
export const OpenByDefault = { render: () => <DialogDemo startOpen /> };
