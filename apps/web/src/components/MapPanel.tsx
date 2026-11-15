import { useMemo } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { MapItem } from "../lib/types";

type MapPanelProps = {
  items: MapItem[];
  variant?: "operations" | "qualification";
  onOpenQualification?: (item: MapItem) => void;
};

const statusLabels: Record<string, string> = {
  SOUMIS: "Soumis",
  COMPLEMENT_REPONDU: "Complément reçu",
  EN_ATTENTE_COMPLEMENT: "En attente du citoyen",
};

function markerColor(item: MapItem) {
  if (item.kind === "DOSSIER") return { stroke: "#205b49", fill: "#4c9875" };
  switch (item.status) {
    case "SOUMIS":
      return { stroke: "#9b702c", fill: "#e0b36d" };
    case "COMPLEMENT_REPONDU":
      return { stroke: "#396c91", fill: "#82b4d2" };
    case "EN_ATTENTE_COMPLEMENT":
      return { stroke: "#777f86", fill: "#bbc3c8" };
    default:
      return { stroke: "#7d8d82", fill: "#9eafa2" };
  }
}

export function MapPanel({
  items,
  variant = "operations",
  onOpenQualification,
}: MapPanelProps) {
  const located = useMemo(
    () =>
      items
        .map((item) => ({ ...item, lat: Number(item.latitude), lon: Number(item.longitude) }))
        .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon)),
    [items],
  );

  const center: [number, number] = located.length
    ? [
        located.reduce((sum, point) => sum + point.lat, 0) / located.length,
        located.reduce((sum, point) => sum + point.lon, 0) / located.length,
      ]
    : [14.7167, -17.4674];

  return (
    <div className="map-wrap">
      <MapContainer
        center={center}
        zoom={located.length ? 11 : 10}
        scrollWheelZoom={false}
        className="command-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {located.map((item) => {
          const colors = markerColor(item);
          const canOpenQualification =
            item.kind === "SIGNALEMENT" &&
            (item.status === "SOUMIS" || item.status === "COMPLEMENT_REPONDU") &&
            Boolean(onOpenQualification);

          return (
            <CircleMarker
              key={item.id}
              center={[item.lat, item.lon]}
              radius={variant === "qualification" ? 6 : item.kind === "DOSSIER" ? 8 : 6}
              pathOptions={{
                color: colors.stroke,
                fillColor: colors.fill,
                fillOpacity: 0.9,
                weight: 2,
              }}
            >
              <Popup>
                <div className="map-popup">
                  <strong>{item.title || "Signalement sans description"}</strong>
                  <span className={`status-chip ${item.status.toLowerCase()}`}>
                    {statusLabels[item.status] ?? item.status}
                  </span>
                  <p>{item.locationLabel || "Localisation renseignée"}</p>
                  {item.occurredAt && (
                    <small>
                      {new Date(item.occurredAt).toLocaleDateString("fr-FR")}
                    </small>
                  )}
                  {canOpenQualification && (
                    <button
                      type="button"
                      className="map-popup-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenQualification?.(item);
                      }}
                    >
                      Ouvrir la qualification
                    </button>
                  )}
                  {item.kind === "SIGNALEMENT" && item.status === "EN_ATTENTE_COMPLEMENT" && (
                    <small className="map-popup-note">
                      La décision reprendra après la réponse du citoyen.
                    </small>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
      {variant === "qualification" ? (
        <div className="map-legend">
          <span><i className="legend-dot report-submitted" />Soumis</span>
          <span><i className="legend-dot report-replied" />Complément reçu</span>
          <span><i className="legend-dot report-waiting" />En attente citoyen</span>
          <span>{located.length} position(s)</span>
        </div>
      ) : (
        <div className="map-legend">
          <span><i className="legend-dot case" />Dossiers</span>
          <span><i className="legend-dot report" />Signalements</span>
          <span>{located.length} position(s)</span>
        </div>
      )}
    </div>
  );
}
