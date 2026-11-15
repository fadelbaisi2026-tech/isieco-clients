import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileCheck2,
  MapPin,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { MapPanel } from "../components/MapPanel";
import { api } from "../lib/api";
import type { CommandCenterOverview, CommandCenterSummary, MapItem } from "../lib/types";

const cards: Array<{
  key: keyof CommandCenterSummary;
  label: string;
  hint: string;
  icon: typeof Activity;
  tone: string;
}> = [
  { key: "reportsAwaitingQualification", label: "À qualifier", hint: "Signalements reçus", icon: Clock3, tone: "amber" },
  { key: "reportsAwaitingCitizen", label: "En attente citoyen", hint: "Compléments demandés", icon: AlertCircle, tone: "blue" },
  { key: "openCases", label: "Dossiers ouverts", hint: "À traiter", icon: FileCheck2, tone: "green" },
  { key: "urgentCases", label: "Prioritaires", hint: "Priorité haute ou critique", icon: Activity, tone: "red" },
  { key: "activeAssignments", label: "Affectations actives", hint: "Missions confiées", icon: ArrowUpRight, tone: "green" },
  { key: "activeInterventions", label: "Sur le terrain", hint: "Interventions en cours", icon: Trash2, tone: "blue" },
  { key: "pendingVerifications", label: "À vérifier", hint: "Comptes rendus soumis", icon: CheckCircle2, tone: "amber" },
  { key: "locatedItems", label: "Géolocalisés", hint: "Éléments placés sur la carte", icon: MapPin, tone: "green" },
];

type QueuePage = {
  items: Array<{ statutSignalement: string }>;
  total: number;
  pageSize: number;
};

type QualificationCounts = {
  submitted: number;
  replied: number;
};

async function loadQualificationCounts(): Promise<QualificationCounts> {
  const pageSize = 100;
  const first = await api.get<QueuePage>(`/qualification/queue?page=1&pageSize=${pageSize}`);
  const allStatuses = [...(first.items ?? []).map((item) => item.statutSignalement)];
  const pageCount = Math.ceil((first.total ?? allStatuses.length) / pageSize);

  // The API caps pageSize at 100. Fetch subsequent pages in small batches so
  // the status totals remain accurate without firing an unbounded request burst.
  for (let page = 2; page <= pageCount; page += 5) {
    const batch = Array.from(
      { length: Math.min(5, pageCount - page + 1) },
      (_, index) => page + index,
    );
    const results = await Promise.all(
      batch.map((pageNumber) =>
        api.get<QueuePage>(`/qualification/queue?page=${pageNumber}&pageSize=${pageSize}`),
      ),
    );
    for (const result of results) {
      allStatuses.push(...(result.items ?? []).map((item) => item.statutSignalement));
    }
  }

  return {
    submitted: allStatuses.filter((status) => status === "SOUMIS").length,
    replied: allStatuses.filter((status) => status === "COMPLEMENT_REPONDU").length,
  };
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isQualificationAgent = profile?.roles.some((role) => role.code === "AGENT_QUALIFICATION") ?? false;
  const [data, setData] = useState<CommandCenterOverview | null>(null);
  const [qualificationCounts, setQualificationCounts] = useState<QualificationCounts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const overviewPromise = api.get<CommandCenterOverview>("/command-center/overview?limit=150");
      const countsPromise = isQualificationAgent ? loadQualificationCounts() : Promise.resolve(null);
      const [overview, counts] = await Promise.all([overviewPromise, countsPromise]);
      setData(overview);
      setQualificationCounts(counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tableau de bord indisponible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const openQualification = (item: MapItem) => {
    navigate(`/espace/qualification?signalement=${encodeURIComponent(item.id)}`);
  };

  if (isQualificationAgent) {
    const reportItems = (data?.map?.items ?? []).filter((item) => item.kind === "SIGNALEMENT");

    return (
      <div className="page-stack qualification-dashboard">
        <div className="page-heading">
          <div>
            <span className="eyebrow">SUIVI DE LA QUALIFICATION</span>
            <h1>Vue d’ensemble des signalements</h1>
            <p>Suivez les signalements selon leur état et accédez directement à ceux qui attendent une décision.</p>
          </div>
          <button className="secondary-button" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            Actualiser
          </button>
        </div>

        {error && (
          <div className="alert error">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button className="text-button" onClick={() => void load()}>Réessayer</button>
          </div>
        )}

        <section className="qualification-stat-grid" aria-label="Statuts des signalements">
          <button
            type="button"
            className="qualification-stat-card soumis"
            onClick={() => navigate("/espace/qualification?statut=SOUMIS")}
          >
            <span className="qualification-stat-label">Nouveaux signalements</span>
            <strong>{loading ? "—" : qualificationCounts?.submitted ?? "—"}</strong>
            <small>À examiner</small>
          </button>
          <button
            type="button"
            className="qualification-stat-card complement"
            onClick={() => navigate("/espace/qualification?statut=COMPLEMENT_REPONDU")}
          >
            <span className="qualification-stat-label">Compléments reçus</span>
            <strong>{loading ? "—" : qualificationCounts?.replied ?? "—"}</strong>
            <small>À reprendre</small>
          </button>
          <button
            type="button"
            className="qualification-stat-card attente"
            onClick={() => navigate("/espace/qualification?statut=EN_ATTENTE_COMPLEMENT")}
          >
            <span className="qualification-stat-label">En attente du citoyen</span>
            <strong>{loading ? "—" : data?.summary?.reportsAwaitingCitizen ?? "—"}</strong>
            <small>Demande de complément ouverte</small>
          </button>
        </section>

        <article className="panel map-panel qualification-map-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">RÉPARTITION GÉOGRAPHIQUE</span>
              <h2>Signalements par statut</h2>
            </div>
            <span className="live-tag"><i />Données API</span>
          </div>
          {loading ? (
            <div className="loading-surface">Chargement des positions…</div>
          ) : (
            <MapPanel
              items={reportItems}
              variant="qualification"
              onOpenQualification={openQualification}
            />
          )}
          <div className="map-footnote">
            <span>{reportItems.length} position(s) de signalement affichée(s)</span>
            <span>{data?.map?.hasMore ? "Affichage cartographique partiel" : "Points colorés selon le statut"}</span>
          </div>
        </article>

        <div className="data-stamp">
          <span>Source : API ISIECO · staging</span>
          <span>
            {data?.generatedAt
              ? `Actualisé à ${new Date(data.generatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
              : "En attente des données"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CENTRE DE COMMANDEMENT</span>
          <h1>Vue d’ensemble</h1>
          <p>La situation opérationnelle de votre territoire, en un seul endroit.</p>
        </div>
        <button className="secondary-button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} className={loading ? "spin" : ""} />
          Actualiser
        </button>
      </div>
      {error && (
        <div className="alert error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button className="text-button" onClick={() => void load()}>Réessayer</button>
        </div>
      )}
      <section className="stats-grid" aria-label="Indicateurs opérationnels">
        {cards.map(({ key, label, hint, icon: Icon, tone }) => (
          <article className="stat-card" key={key}>
            <div className={`stat-icon ${tone}`}><Icon size={19} /></div>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{loading ? "—" : data?.summary?.[key] ?? "—"}</div>
            <div className="stat-hint">{hint}</div>
          </article>
        ))}
      </section>
      <section className="dashboard-lower">
        <article className="panel map-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">SITUATION GÉOGRAPHIQUE</span><h2>Carte des opérations</h2></div>
            <span className="live-tag"><i />Données API</span>
          </div>
          {loading ? <div className="loading-surface">Chargement des positions…</div> : <MapPanel items={data?.map?.items ?? []} />}
          <div className="map-footnote">
            <span>{data?.map?.totalLocated ?? 0} éléments localisés</span>
            <span>{data?.summary?.withoutLocation ?? 0} sans coordonnées</span>
          </div>
        </article>
        <article className="panel focus-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">POINT DE VIGILANCE</span><h2>Qualité des données</h2></div>
            <div className="quality-icon"><MapPin size={18} /></div>
          </div>
          <div className="quality-number">{loading ? "—" : data?.summary?.withoutLocation ?? 0}</div>
          <p>élément(s) actif(s) sans coordonnées exploitables.</p>
          <div className="quality-divider" />
          <div className="quality-row"><span>Position disponible</span><strong>{loading ? "—" : data?.summary?.locatedItems ?? 0}</strong></div>
          <div className="quality-row"><span>Position manquante</span><strong>{loading ? "—" : data?.summary?.withoutLocation ?? 0}</strong></div>
          <p className="small-note">La carte affiche uniquement les coordonnées connues. Aucune adresse n’est estimée.</p>
        </article>
      </section>
      <div className="data-stamp">
        <span>Source : API ISIECO · staging</span>
        <span>
          {data?.generatedAt
            ? `Actualisé à ${new Date(data.generatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
            : "En attente des données"}
        </span>
      </div>
    </div>
  );
}
