let presenter = null;

export function registerPolicyPresenter(fn) {
  presenter = fn;
  return () => {
    if (presenter === fn) presenter = null;
  };
}

export function showPolicyConsent({ title, body, confirmLabel, cancelLabel }) {
  return new Promise((resolve) => {
    if (!presenter) {
      resolve(false);
      return;
    }
    presenter({
      title,
      body,
      confirmLabel: confirmLabel || "J'accepte",
      cancelLabel: cancelLabel || "Refuser",
      resolve,
    });
  });
}
