let presenter = null;
const queue = [];
let active = false;

export function registerDialogPresenter(fn) {
  presenter = fn;
  pump();
  return () => {
    if (presenter === fn) presenter = null;
  };
}

function pump() {
  if (active || !presenter || queue.length === 0) return;
  active = true;
  const next = queue.shift();
  presenter(next);
}

export function finishDialog() {
  active = false;
  pump();
}

/**
 * @param {{ title: string, message: string, actions: { label: string, value: unknown, variant?: string }[] }} options
 */
export function showDialog(options) {
  return new Promise((resolve) => {
    queue.push({ ...options, resolve });
    pump();
  });
}

export function alertDialog({ title, message, confirmLabel = "OK" }) {
  return showDialog({
    title,
    message,
    actions: [{ label: confirmLabel, value: true, variant: "primary" }],
  });
}

export function confirmDialog({
  title,
  message,
  confirmLabel = "Continuer",
  cancelLabel = "Annuler",
  destructive = false,
}) {
  return showDialog({
    title,
    message,
    actions: [
      { label: cancelLabel, value: false },
      {
        label: confirmLabel,
        value: true,
        variant: destructive ? "danger" : "primary",
      },
    ],
  }).then(Boolean);
}
