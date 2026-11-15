import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { AppShell } from "./components/AppShell";
import { LoginPage } from "./pages/LoginPage";

const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })),
);
const WorkspacePage = lazy(() =>
  import("./pages/WorkspacePage").then((module) => ({ default: module.WorkspacePage })),
);
const QualificationPage = lazy(() =>
  import("./pages/QualificationPage").then((module) => ({ default: module.QualificationPage })),
);
const CasesPage = lazy(() =>
  import("./pages/CasesPage").then((module) => ({ default: module.CasesPage })),
);
const AssignmentsPage = lazy(() =>
  import("./pages/AssignmentsPage").then((module) => ({ default: module.AssignmentsPage })),
);
const FieldOpsPage = lazy(() =>
  import("./pages/FieldOpsPage").then((module) => ({ default: module.FieldOpsPage })),
);
const VerificationPage = lazy(() =>
  import("./pages/VerificationPage").then((module) => ({ default: module.VerificationPage })),
);
const ReferentialsPage = lazy(() =>
  import("./pages/ReferentialsPage").then((module) => ({ default: module.ReferentialsPage })),
);
const AccountsPage = lazy(() =>
  import("./pages/AccountsPage").then((module) => ({ default: module.AccountsPage })),
);

const backOffice = [
  "AGENT_QUALIFICATION",
  "RESPONSABLE_TRAITEMENT",
  "RESPONSABLE_AFFECTATION",
  "VERIFICATEUR_CLOTURE",
  "GESTIONNAIRE_REFERENTIEL",
  "ADMINISTRATEUR_COMPTES",
];

const sectionRole: Record<string, string> = {
  "mes-signalements": "CITOYEN",
  qualification: "AGENT_QUALIFICATION",
  dossiers: "RESPONSABLE_TRAITEMENT",
  affectations: "RESPONSABLE_AFFECTATION",
  interventions: "AGENT_TERRAIN",
  verification: "VERIFICATEUR_CLOTURE",
  referentiels: "GESTIONNAIRE_REFERENTIEL",
  comptes: "ADMINISTRATEUR_COMPTES",
};

function Root() {
  const { profile, session, loading, profileError, profileErrorKind } = useAuth();

  if (loading) return <div className="full-loader">Vérification de votre session…</div>;
  if (!session) return <Navigate to="/connexion" replace />;

  if (profileError) {
    const title =
      profileErrorKind === "service"
        ? "Service ISIECO indisponible"
        : profileErrorKind === "session"
          ? "Session à vérifier"
          : "Profil métier indisponible";

    const detail =
      profileErrorKind === "service"
        ? "Votre session Supabase est présente, mais l’API ISIECO n’a pas répondu. Le profil n’a pas été supprimé."
        : profileErrorKind === "session"
          ? "La session de connexion n’a pas pu être vérifiée. Reconnectez-vous."
          : "Le backend doit associer votre identité Supabase à un profil ISIECO actif.";

    return (
      <div className="full-loader">
        <div className="access-card">
          <h2>{title}</h2>
          <p>{profileError}</p>
          <small>{detail}</small>
        </div>
      </div>
    );
  }

  const roles = profile?.roles.map((role) => role.code) ?? [];
  if (roles.includes("AGENT_TERRAIN")) return <Navigate to="/espace/interventions" replace />;
  if (roles.some((role) => backOffice.includes(role))) {
    return <Navigate to="/centre-de-commande" replace />;
  }
  if (roles.includes("CITOYEN")) return <Navigate to="/espace/mes-signalements" replace />;
  return <div className="full-loader">Aucun espace n’est associé à ce compte.</div>;
}

function Protected({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="full-loader">Chargement…</div>;
  return session ? <>{children}</> : <Navigate to="/connexion" replace />;
}

function RoleRoute({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { profile } = useAuth();
  return profile?.roles.some((role) => roles.includes(role.code)) ? (
    <>{children}</>
  ) : (
    <Navigate to="/" replace />
  );
}

function SectionRoute() {
  const { section = "" } = useParams();
  const { profile } = useAuth();
  const role = sectionRole[section];

  if (!role) {
    return (
      <div className="empty-state">
        <h2>Section introuvable</h2>
      </div>
    );
  }

  if (!profile?.roles.some((item) => item.code === role)) return <Navigate to="/" replace />;

  switch (section) {
    case "qualification":
      return <QualificationPage />;
    case "dossiers":
      return <CasesPage />;
    case "affectations":
      return <AssignmentsPage />;
    case "interventions":
      return <FieldOpsPage />;
    case "verification":
      return <VerificationPage />;
    case "referentiels":
      return <ReferentialsPage />;
    case "comptes":
      return <AccountsPage />;
    default:
      return <WorkspacePage />;
  }
}

export function App() {
  return (
    <Suspense fallback={<div className="full-loader">Chargement de votre espace…</div>}>
      <Routes>
        <Route path="/connexion" element={<LoginPage />} />
        <Route path="/" element={<Root />} />
        <Route
          path="/"
          element={
            <Protected>
              <AppShell />
            </Protected>
          }
        >
          <Route
            path="centre-de-commande"
            element={
              <RoleRoute roles={backOffice}>
                <DashboardPage />
              </RoleRoute>
            }
          />
          <Route path="espace/:section" element={<SectionRoute />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
