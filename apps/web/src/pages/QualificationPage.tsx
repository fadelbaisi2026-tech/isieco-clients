import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Eye,
  FileImage,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { ApiError } from "@isieco/api-client";

type Content = {
  idTypeDechet: string;
  quantiteEstimee: string | null;
  volumeEstime: string | null;
  remarque: string | null;
  etatQualification: string;
  typeDechet: { codeType: string; libelle: string };
};
type Photo = { idPhotoSignalement: string; description: string | null; dateAjout: string };
type Report = {
  idSignalement: string;
  statutSignalement: string;
  dateSoumission: string | null;
  description: string | null;
  localisation?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  utilisateur: { nom: string; prenom: string | null };
  contenus: Content[];
  demandesComplement: Record<string, unknown>[];
  photos?: Photo[];
};

type QueueFilter = "TOUS" | "SOUMIS" | "COMPLEMENT_REPONDU" | "EN_ATTENTE_COMPLEMENT";

const labelStatus: Record<string, string> = {
  SOUMIS: "Soumis",
  COMPLEMENT_REPONDU: "Complément reçu",
  EN_ATTENTE_COMPLEMENT: "En attente du citoyen",
};

export function QualificationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedReportId = searchParams.get("signalement");
  const requestedStatus = searchParams.get("statut");
  const [items, setItems] = useState<Report[]>([]);
  const [queueTotal, setQueueTotal] = useState(0);
  const [waitingCitizenCount, setWaitingCitizenCount] = useState<number | null>(null);
  const [filter, setFilter] = useState<QueueFilter>("TOUS");
  const [active, setActive] = useState<Report | null>(null);
  const [mode, setMode] = useState<"ACCEPT" | "REJECT" | "SUPPLEMENT" | null>(null);
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [photoLoading, setPhotoLoading] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; label: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    const overviewPromise = api.get<{ summary: { reportsAwaitingCitizen: number } }>(
      "/command-center/overview?limit=1",
    );

    try {
      const queue = await api.get<{ items: Report[]; total: number }>(
        "/qualification/queue?page=1&pageSize=100",
      );
      setItems(queue.items ?? []);
      setQueueTotal(queue.total ?? queue.items?.length ?? 0);

      try {
        const overview = await overviewPromise;
        setWaitingCitizenCount(overview.summary?.reportsAwaitingCitizen ?? 0);
      } catch {
        setWaitingCitizenCount(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger la file.");
      void overviewPromise.then(
        (overview) => setWaitingCitizenCount(overview.summary?.reportsAwaitingCitizen ?? 0),
        () => setWaitingCitizenCount(null),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (
      requestedStatus === "SOUMIS" ||
      requestedStatus === "COMPLEMENT_REPONDU" ||
      requestedStatus === "EN_ATTENTE_COMPLEMENT"
    ) {
      setFilter(requestedStatus);
    } else if (!requestedStatus) {
      setFilter("TOUS");
    }
  }, [requestedStatus]);

  async function loadReportDetail(idSignalement: string) {
    setError(null);
    setMode(null);
    setPhotoUrls({});
    setPreviewPhoto(null);
    setPhotoLoading(false);

    try {
      const detail = await api.get<Report>(`/qualification/${idSignalement}`);
      setActive(detail);
      setSelected(
        (detail.contenus ?? [])
          .filter((content) => content.etatQualification !== "RETIRE")
          .map((content) => content.idTypeDechet),
      );

      const photos = detail.photos ?? [];
      if (photos.length > 0) {
        setPhotoLoading(true);
        const previews = await Promise.all(
          photos.map(async (photo) => {
            try {
              const result = await api.get<{ signedUrl: string }>(
                `/qualification/${idSignalement}/photos/${photo.idPhotoSignalement}/url`,
              );
              return [photo.idPhotoSignalement, result.signedUrl] as const;
            } catch {
              return null;
            }
          }),
        );
        setPhotoUrls(
          Object.fromEntries(
            previews.filter(
              (entry): entry is readonly [string, string] => entry !== null,
            ),
          ),
        );
      }
    } catch (e) {
      setActive(null);
      setError(e instanceof Error ? e.message : "Détail indisponible.");
    } finally {
      setPhotoLoading(false);
    }
  }

  async function openItem(item: Report) {
    setActive(item);
    await loadReportDetail(item.idSignalement);
  }

  useEffect(() => {
    if (!requestedReportId) return;
    void loadReportDetail(requestedReportId);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("signalement");
        return next;
      },
      { replace: true },
    );
  }, [requestedReportId]);

  const filteredItems = useMemo(() => {
    if (filter === "EN_ATTENTE_COMPLEMENT") return [];
    if (filter === "TOUS") return items;
    return items.filter((item) => item.statutSignalement === filter);
  }, [filter, items]);

  const submittedCount = items.filter((item) => item.statutSignalement === "SOUMIS").length;
  const repliedCount = items.filter((item) => item.statutSignalement === "COMPLEMENT_REPONDU").length;

  async function submit() {
    if (!active || !mode) return;
    if (mode !== "ACCEPT" && reason.trim().length < 5) {
      setError("Le motif doit contenir au moins 5 caractères.");
      return;
    }
    if (mode === "ACCEPT" && selected.length === 0) {
      setError("Sélectionnez au moins une catégorie retenue.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (mode === "ACCEPT") {
        const contenus = active.contenus
          .filter((content) => selected.includes(content.idTypeDechet))
          .map((content) => ({
            idTypeDechet: content.idTypeDechet,
            ...(content.quantiteEstimee ? { quantiteEstimee: Number(content.quantiteEstimee) } : {}),
            ...(content.volumeEstime ? { volumeEstime: Number(content.volumeEstime) } : {}),
            ...(content.remarque ? { remarque: content.remarque } : {}),
          }));
        await api.post(`/qualification/${active.idSignalement}/accept`, { contenus });
      } else if (mode === "REJECT") {
        await api.post(`/qualification/${active.idSignalement}/reject`, { motif: reason.trim() });
      } else {
        await api.post(`/qualification/${active.idSignalement}/supplements`, { motif: reason.trim() });
      }

      setSuccess(
        mode === "ACCEPT"
          ? "Signalement qualifié."
          : mode === "REJECT"
            ? "Signalement rejeté."
            : "Demande de complément envoyée.",
      );
      setActive(null);
      setMode(null);
      setReason("");
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Décision impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">TRAITEMENT ENTRANT</span>
          <h1>Qualification des signalements</h1>
          <p>Examinez les nouveaux signalements et les réponses citoyennes reçues, puis consignez une décision.</p>
        </div>
        <button className="secondary-button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} className={loading ? "spin" : ""} />
          Actualiser
        </button>
      </div>

      {success && (
        <div className="alert success">
          <Check size={17} />
          {success}
          <button className="text-button" onClick={() => setSuccess(null)}>Fermer</button>
        </div>
      )}
      {error && (
        <div className="alert error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button className="text-button" onClick={() => setError(null)}>Fermer</button>
        </div>
      )}

      {!active ? (
        <section className="panel workflow-panel">
          <div className="table-toolbar">
            <div>
              <strong>{loading ? "Chargement…" : queueTotal} signalement(s) dans la file de décision</strong>
              {queueTotal > items.length && <span> · Affichage des {items.length} premiers</span>}
            </div>
            <span className="live-tag"><i />API connectée</span>
          </div>

          <div className="qualification-queue-summary">
            <div>
              <strong>{waitingCitizenCount ?? "—"}</strong>
              <span>en attente d’une réponse citoyenne</span>
              <small>Ces signalements sont suspendus et ne peuvent pas encore recevoir de décision.</small>
            </div>
            <button
              type="button"
              className="secondary-button compact"
              onClick={() => setFilter("EN_ATTENTE_COMPLEMENT")}
            >
              Voir cet état
            </button>
          </div>

          <nav className="queue-filters" aria-label="Filtrer les signalements par statut">
            <button
              type="button"
              className={filter === "TOUS" ? "selected" : ""}
              onClick={() => setFilter("TOUS")}
            >
              Tous à traiter <b>{queueTotal}</b>
            </button>
            <button
              type="button"
              className={filter === "SOUMIS" ? "selected" : ""}
              onClick={() => setFilter("SOUMIS")}
            >
              Soumis <b>{submittedCount}</b>
            </button>
            <button
              type="button"
              className={filter === "COMPLEMENT_REPONDU" ? "selected" : ""}
              onClick={() => setFilter("COMPLEMENT_REPONDU")}
            >
              Complément reçu <b>{repliedCount}</b>
            </button>
            <button
              type="button"
              className={filter === "EN_ATTENTE_COMPLEMENT" ? "selected" : ""}
              onClick={() => setFilter("EN_ATTENTE_COMPLEMENT")}
            >
              En attente citoyen <b>{waitingCitizenCount ?? "—"}</b>
            </button>
          </nav>

          {filter === "EN_ATTENTE_COMPLEMENT" ? (
            <div className="waiting-status-panel">
              <span className="status-chip en_attente_complement">En attente du citoyen</span>
              <h3>{waitingCitizenCount ?? "—"} signalement(s) suspendu(s)</h3>
              <p>
                Une demande de complément a été envoyée. Le signalement reviendra dans la file de décision
                lorsque le citoyen aura répondu. Son statut sera alors « Complément reçu ».
              </p>
              <p className="muted">
                Les positions disponibles restent visibles sur la carte de la vue d’ensemble.
              </p>
            </div>
          ) : loading ? (
            <div className="loading-surface">Chargement de la file…</div>
          ) : filteredItems.length === 0 ? (
            <div className="empty-state">
              <h3>{filter === "SOUMIS" ? "Aucun nouveau signalement" : filter === "COMPLEMENT_REPONDU" ? "Aucun complément reçu" : "La file est vide"}</h3>
              <p>Aucun signalement ne correspond à ce statut pour le moment.</p>
            </div>
          ) : (
            <div className="workflow-list">
              {filteredItems.map((item) => (
                <button
                  className="workflow-row"
                  key={item.idSignalement}
                  onClick={() => void openItem(item)}
                >
                  <div className="workflow-row-main">
                    <strong>{item.description || "Signalement sans description"}</strong>
                    <span>
                      {item.utilisateur?.prenom} {item.utilisateur?.nom} · {item.localisation || "Localisation non précisée"}
                    </span>
                    <small>{item.contenus?.map((content) => content.typeDechet?.libelle).join(", ") || "Aucune catégorie déclarée"}</small>
                  </div>
                  <div className="workflow-row-aside">
                    <span className={`status-chip ${item.statutSignalement.toLowerCase()}`}>
                      {labelStatus[item.statutSignalement] || item.statutSignalement}
                    </span>
                    <span>{item.dateSoumission ? new Date(item.dateSoumission).toLocaleDateString("fr-FR") : "—"}</span>
                    <Eye size={17} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="panel detail-panel">
          <div className="detail-top">
            <button className="text-button back-button" onClick={() => setActive(null)}>
              <ArrowLeft size={16} /> Retour à la file
            </button>
            <span className={`status-chip ${active.statutSignalement.toLowerCase()}`}>
              {labelStatus[active.statutSignalement] || active.statutSignalement}
            </span>
          </div>

          <div className="detail-title">
            <span className="eyebrow">DOSSIER DE QUALIFICATION</span>
            <h2>{active.description || "Signalement sans description"}</h2>
            <p>
              Déposé par {active.utilisateur?.prenom} {active.utilisateur?.nom} ·{" "}
              {active.dateSoumission ? new Date(active.dateSoumission).toLocaleString("fr-FR") : "Date non fournie"}
            </p>
          </div>

          <div className="detail-grid">
            <div><span className="field-label">Localisation</span><p>{active.localisation || "Non renseignée"}</p></div>
            <div><span className="field-label">Coordonnées</span><p>{active.latitude && active.longitude ? `${active.latitude}, ${active.longitude}` : "Aucune coordonnée"}</p></div>
            <div><span className="field-label">Catégories déclarées</span><p>{active.contenus?.map((content) => content.typeDechet?.libelle).join(", ") || "Aucune catégorie"}</p></div>
          </div>

          <div className="detail-section">
            <div className="section-heading">
              <h3>Pièces jointes</h3>
              <span>{active.photos?.length ?? 0} photo(s)</span>
            </div>
            <div className="photo-strip">
              {(active.photos ?? []).map((photo) => (
                <button
                  type="button"
                  className="photo-tile photo-preview-tile"
                  key={photo.idPhotoSignalement}
                  onClick={() => {
                    const url = photoUrls[photo.idPhotoSignalement];
                    if (url) setPreviewPhoto({ url, label: photo.description || "Photo de signalement" });
                  }}
                  disabled={!photoUrls[photo.idPhotoSignalement]}
                >
                  {photoUrls[photo.idPhotoSignalement] ? (
                    <img src={photoUrls[photo.idPhotoSignalement]} alt={photo.description || "Photo du signalement"} loading="lazy" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="photo-preview-placeholder">
                      {photoLoading ? <FileImage size={22} /> : <AlertCircle size={22} />}
                      {photoLoading ? "Chargement de l’aperçu…" : "Aperçu indisponible"}
                    </span>
                  )}
                  <span>{photo.description || "Photo de signalement"}</span>
                  <small>{photoUrls[photo.idPhotoSignalement] ? "Cliquer pour agrandir" : "Image privée non accessible"}</small>
                </button>
              ))}
              {!active.photos?.length && <p className="muted">Aucune photo jointe.</p>}
            </div>
          </div>

          <div className="detail-section">
            <h3>Catégories à retenir</h3>
            {active.contenus?.length ? (
              active.contenus.map((content) => (
                <label className="check-row" key={content.idTypeDechet}>
                  <input
                    type="checkbox"
                    checked={selected.includes(content.idTypeDechet)}
                    onChange={(event) =>
                      setSelected((old) =>
                        event.target.checked
                          ? [...old, content.idTypeDechet]
                          : old.filter((id) => id !== content.idTypeDechet),
                      )
                    }
                  />
                  <span>
                    <strong>{content.typeDechet?.libelle}</strong>
                    <small>
                      {content.quantiteEstimee ? `Quantité estimée : ${content.quantiteEstimee}` : "Quantité non précisée"}
                      {content.remarque ? ` · ${content.remarque}` : ""}
                    </small>
                  </span>
                  <em>{content.etatQualification}</em>
                </label>
              ))
            ) : (
              <div className="alert info">
                Ce signalement ne contient pas de catégorie source. Demandez un complément au citoyen avant de qualifier.
              </div>
            )}
          </div>

          <div className="detail-actions">
            <button className="primary-button" onClick={() => setMode("ACCEPT")} disabled={!active.contenus?.length}>
              <Check size={16} /> Valider la qualification
            </button>
            <button className="secondary-button" onClick={() => setMode("SUPPLEMENT")}>
              <Send size={16} /> Demander un complément
            </button>
            <button className="danger-button" onClick={() => setMode("REJECT")}>
              <X size={16} /> Rejeter
            </button>
          </div>

          {mode && (
            <form
              className="action-form"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <div className="section-heading">
                <h3>
                  {mode === "ACCEPT"
                    ? "Confirmer les catégories retenues"
                    : mode === "REJECT"
                      ? "Motif du rejet"
                      : "Informations à demander"}
                </h3>
                <button type="button" className="icon-button light" onClick={() => setMode(null)}>
                  <X size={16} />
                </button>
              </div>
              {mode === "ACCEPT" ? (
                <p className="muted">
                  Les catégories sélectionnées seront marquées RETENU, les autres RETIRE. La transition sera journalisée dans le backend.
                </p>
              ) : (
                <>
                  <textarea
                    required
                    minLength={5}
                    maxLength={2000}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={mode === "REJECT"
                      ? "Expliquez pourquoi le signalement est rejeté…"
                      : "Précisez les informations manquantes à fournir…"}
                  />
                  <small>5 à 2 000 caractères</small>
                </>
              )}
              <button className="primary-button" disabled={busy}>
                {busy ? "Enregistrement…" : "Confirmer la décision"}
              </button>
            </form>
          )}
        </section>
      )}

      {previewPhoto && (
        <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="Aperçu de la photo" onClick={() => setPreviewPhoto(null)}>
          <button type="button" className="photo-lightbox-close" onClick={() => setPreviewPhoto(null)}>Fermer</button>
          <img src={previewPhoto.url} alt={previewPhoto.label} onClick={(event) => event.stopPropagation()} />
          <span>{previewPhoto.label}</span>
        </div>
      )}
    </div>
  );
}
