import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, CornerDownLeft, Terminal, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { requestAggregation } from "../services/adminApi";
import { useToast } from "../context/ToastContext";

const COMMANDS = [
  { title: "Ouvrir les statistiques", description: "Vue d’ensemble", aliases: ["stats", "statistiques", "accueil"], path: "/" },
  { title: "Ouvrir les menaces", description: "Modération et revue", aliases: ["menaces", "threats", "menace"], path: "/threats" },
  { title: "Ouvrir les signalements", description: "File de revue", aliases: ["signalements", "reports", "report"], path: "/reports" },
  { title: "Ouvrir les opérations", description: "Canary, politiques et agrégation", aliases: ["operations", "opérations", "canary"], path: "/operations" },
  { title: "Ouvrir l’entraînement", description: "Jeux et entraînements ML", aliases: ["training", "entraînement", "dataset", "datasets", "jeu"], path: "/training" },
  { title: "Ouvrir la Porte de liens", description: "Événements de liens", aliases: ["link gate", "liens", "porte de liens"], path: "/link-gate" },
  { title: "Ouvrir les applications", description: "Catalogue surveillé", aliases: ["apps", "applications"], path: "/applications" },
  { title: "Ouvrir les utilisateurs", description: "Comptes administrés", aliases: ["users", "utilisateurs"], path: "/users" },
  { title: "Ouvrir le guide", description: "Articles et catégories", aliases: ["guide", "articles"], path: "/guide" },
  { title: "Ouvrir les politiques", description: "Textes présentés dans l’app", aliases: ["policies", "politiques"], path: "/policies" },
];

function normalize(value) {
  return value.toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export default function CommandPalette({ open, onOpen, onClose }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const inputRef = useRef(null);
  const previousFocus = useRef(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [confirmAggregation, setConfirmAggregation] = useState(false);
  const [busy, setBusy] = useState(false);

  const commands = useMemo(() => {
    const normalized = normalize(query);
    const search = normalized.replace(/^\/?(?:ouvrir|aller|go|open)\s+(?:(?:la|le|les)\s+)?/, "").replace(/^\//, "");
    const routes = COMMANDS.filter((command) =>
      !search || [command.title, command.description, ...command.aliases]
        .some((value) => normalize(value).includes(search) || search.includes(normalize(value))),
    ).map((command) => ({ ...command, kind: "navigate" }));
    const threatMatch = normalized.match(/^(?:\/?(?:ouvrir\s+)?(?:la\s+)?)?(?:menace|threat)\s+#?(\d+)$/);
    if (threatMatch) {
      routes.unshift({
        title: `Ouvrir la menace #${threatMatch[1]}`,
        description: "Accéder directement à sa fiche",
        kind: "navigate",
        path: `/threats/${threatMatch[1]}`,
      });
    }
    const aggregateMatches = ["aggreger", "aggregate", "aggregation", "lancer aggregation", "executer aggregation", "run aggregation"]
      .some((phrase) => phrase.includes(search) || search.includes(phrase));
    if (aggregateMatches && search) {
      routes.unshift({
        title: "Exécuter l’agrégation hebdomadaire",
        description: "Écrit un manifeste policy à partir des 7 derniers jours",
        kind: "aggregate",
      });
    }
    return routes;
  }, [query]);

  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;
    setQuery("");
    setActiveIndex(0);
    setConfirmAggregation(false);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      if (previousFocus.current instanceof HTMLElement) previousFocus.current.focus();
    };
  }, [open]);

  useEffect(() => {
    function handleShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) onClose();
        else onOpen();
      }
    }
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [open, onClose, onOpen]);

  if (!open) return null;

  async function execute(command) {
    if (command.kind === "navigate") {
      navigate(command.path);
      onClose();
      return;
    }
    if (!confirmAggregation) {
      setConfirmAggregation(true);
      return;
    }
    setBusy(true);
    try {
      const run = await requestAggregation();
      toast(run.status === "SUCCEEDED" ? "Agrégation terminée. Manifeste hebdomadaire généré." : run.message, run.status === "SUCCEEDED" ? "success" : "error");
      navigate("/operations");
      onClose();
    } catch (error) {
      toast(error.message || "L’agrégation a échoué.", "error");
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); }
    else if (event.key === "ArrowDown" && commands.length) { event.preventDefault(); setActiveIndex((index) => (index + 1) % commands.length); }
    else if (event.key === "ArrowUp" && commands.length) { event.preventDefault(); setActiveIndex((index) => (index - 1 + commands.length) % commands.length); }
    else if (event.key === "Enter" && !confirmAggregation && commands[activeIndex]) { event.preventDefault(); execute(commands[activeIndex]); }
    else if (event.key === "Tab") {
      const focusable = event.currentTarget.querySelectorAll("input:not([disabled]), button:not([disabled])");
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }

  return createPortal(
    <div className="command-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="command-dialog" role="dialog" aria-modal="true" aria-label="Commandes SafeDM" onKeyDown={handleKeyDown}>
        <div className="command-input-row">
          <Terminal size={18} aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); setConfirmAggregation(false); }}
            placeholder="Commande SafeDM… ex. ouvrir menaces"
            aria-label="Rechercher une commande SafeDM"
            aria-controls={!confirmAggregation ? "command-results" : undefined}
            aria-activedescendant={!confirmAggregation && commands[activeIndex] ? `command-option-${activeIndex}` : undefined}
            autoComplete="off"
            spellCheck="false"
          />
          <kbd>ESC</kbd>
          <button type="button" className="icon-btn" onClick={() => onClose()} aria-label="Fermer les commandes"><X size={18} aria-hidden /></button>
        </div>
        {confirmAggregation ? (
          <div className="command-confirm">
            <p><strong>Confirmer l’agrégation ?</strong></p>
            <p>Cette action écrit un manifeste policy à partir des signalements et menaces des 7 derniers jours. Elle ne réentraîne pas les poids du modèle.</p>
            <button type="button" className="btn primary" disabled={busy} onClick={() => execute({ kind: "aggregate" })}>{busy ? "Agrégation…" : "Confirmer et exécuter"}</button>
          </div>
        ) : (
          <>
            <div id="command-results" className="command-results" role="listbox" aria-label="Commandes disponibles">
              {commands.length ? commands.map((command, index) => (
                <button
                  id={`command-option-${index}`}
                  key={`${command.kind}-${command.title}`}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  className={activeIndex === index ? "command-option active" : "command-option"}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => execute(command)}
                >
                  <span><strong>{command.title}</strong><small>{command.description}</small></span>
                  {activeIndex === index ? <CornerDownLeft size={16} aria-hidden /> : <ArrowRight size={15} aria-hidden />}
                </button>
              )) : <p className="command-empty">Aucune commande trouvée.</p>}
            </div>
            <footer className="command-footer"><span>↑ ↓ naviguer</span><span>↵ ouvrir</span><span>Commandes SafeDM uniquement</span></footer>
          </>
        )}
      </section>
    </div>,
    document.body,
  );
}
