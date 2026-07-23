import { useState } from "react";
import { Modal, ModalFooter } from "./Modal";
import Button from "./Button";

export default {
  title: "UI/Modal",
  component: Modal,
  parameters: { layout: "centered" },
};

function ModalDemo({ startOpen = false }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open modal</Button>
      {open && (
        <Modal
          title="Add contractor"
          description="Invite a contractor to this building."
          onClose={() => setOpen(false)}
        >
          <div className="mb-4">
            <input
              className="filter-input w-full"
              placeholder="Contractor email"
            />
          </div>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)}>Send invite</Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}

export const Default = { render: () => <ModalDemo /> };
export const OpenByDefault = { render: () => <ModalDemo startOpen /> };
