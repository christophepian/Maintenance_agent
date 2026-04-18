import { cn } from "../../lib/utils";

/**
 * Modal — overlay dialog with title, optional description, body, and footer.
 *
 * Usage:
 *   {showModal && (
 *     <Modal title="Confirm Action" onClose={() => setShowModal(false)}>
 *       <div className="mb-4">…form fields…</div>
 *       <ModalFooter>
 *         <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
 *         <Button variant="primary" onClick={handleConfirm}>Confirm</Button>
 *       </ModalFooter>
 *     </Modal>
 *   )}
 *
 * Props:
 *   title       — modal heading (required)
 *   description — optional subtext below the title
 *   maxWidth    — Tailwind max-width class (default: "max-w-md")
 *   onClose     — called when overlay is clicked
 */
export function Modal({ title, description, maxWidth, onClose, children }) {
  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
    >
      <div className={cn("bg-white rounded-xl shadow-lg p-6 w-full mx-4", maxWidth || "max-w-md")}>
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        {description && <p className="text-sm text-muted-text mb-4">{description}</p>}
        {children}
      </div>
    </div>
  );
}

/**
 * ModalFooter — right-aligned button row inside a Modal.
 */
export function ModalFooter({ children, className }) {
  return (
    <div className={cn("flex justify-end gap-2", className)}>
      {children}
    </div>
  );
}
