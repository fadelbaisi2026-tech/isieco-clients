import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { api } from "../src/lib/api";
import { createIdempotencyKey } from "@isieco/api-client";

interface WasteType {
  idTypeDechet: string;
  codeType: string;
  libelle: string;
}

export default function NewReport() {
  const [description, setDescription] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [coords, setCoords] = useState<Location.LocationObjectCoords | null>(null);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [wasteTypes, setWasteTypes] = useState<WasteType[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [typesError, setTypesError] = useState<string | null>(null);
  const [typesReload, setTypesReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let active = true;
    setTypesLoading(true);
    setTypesError(null);
    api.get<WasteType[]>("/reports/waste-types")
      .then((rows) => {
        if (active) setWasteTypes(Array.isArray(rows) ? rows : []);
      })
      .catch((error: unknown) => {
        if (active) {
          setTypesError(error instanceof Error ? error.message : "Les catégories sont indisponibles.");
        }
      })
      .finally(() => {
        if (active) setTypesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [typesReload]);

  function toggleType(id: string) {
    setSelectedTypes((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function attach() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photos", "L’accès à la photothèque est nécessaire pour joindre une image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
  }

  async function locate() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error("Autorisation de localisation refusée.");
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords(position.coords);
      setLocationLabel((current) => current || "Position actuelle");
    } catch (error) {
      Alert.alert(
        "Localisation",
        error instanceof Error ? error.message : "Position indisponible.",
      );
    } finally {
      setLocating(false);
    }
  }

  async function submit() {
    const hasUsefulInformation =
      Boolean(description.trim()) ||
      Boolean(locationLabel.trim()) ||
      Boolean(coords) ||
      Boolean(photo) ||
      selectedTypes.length > 0;

    if (!hasUsefulInformation) {
      Alert.alert(
        "Signalement incomplet",
        "Ajoutez une description, une catégorie, une photo ou une indication de localisation.",
      );
      return;
    }

    setBusy(true);
    try {
      const key = createIdempotencyKey();
      const contents = selectedTypes.map((idTypeDechet) => ({ idTypeDechet }));
      const metadata = {
        description: description.trim() || undefined,
        descriptionLocalisation: locationLabel.trim() || undefined,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        precisionLocalisation: coords?.accuracy ?? undefined,
        dateConstat: new Date().toISOString(),
        contenus: contents,
      };

      if (photo) {
        const body = new FormData();
        body.append(
          "file",
          {
            uri: photo.uri,
            name: photo.fileName || "signalement.jpg",
            type: photo.mimeType || "image/jpeg",
          } as unknown as Blob,
        );
        Object.entries(metadata).forEach(([key, value]) => {
          if (key === "contenus") {
            if (contents.length) body.append("contenus", JSON.stringify(contents));
          } else if (value !== undefined && value !== "") {
            body.append(key, String(value));
          }
        });
        await api.post("/reports/with-photo", body, {
          headers: { "Idempotency-Key": key },
        });
      } else {
        await api.post("/reports", metadata, {
          headers: { "Idempotency-Key": key },
        });
      }

      Alert.alert("Signalement envoyé", "Votre signalement a été transmis à ISIECO.", [
        { text: "Terminer", onPress: () => router.replace("/") },
      ]);
    } catch (error) {
      Alert.alert(
        "Envoi impossible",
        error instanceof Error ? error.message : "Le signalement n’a pas pu être envoyé.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={s.back}>‹  Retour à mes signalements</Text>
      </TouchableOpacity>

      <Text style={s.kicker}>NOUVEAU SIGNALEMENT</Text>
      <Text style={s.title}>Décrire une situation.</Text>
      <Text style={s.subtitle}>
        Ajoutez les informations utiles pour aider les équipes à intervenir au bon endroit.
      </Text>

      <Text style={s.label}>Catégories de déchets (facultatif)</Text>
      {typesLoading ? (
        <View style={s.loadingTypes}>
          <ActivityIndicator color="#46765b" />
          <Text style={s.helper}>Chargement des catégories…</Text>
        </View>
      ) : typesError ? (
        <View style={s.typeError}>
          <Text style={s.typeErrorText}>{typesError}</Text>
          <TouchableOpacity onPress={() => setTypesReload((value) => value + 1)}>
            <Text style={s.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : wasteTypes.length ? (
        <View style={s.choices}>
          {wasteTypes.map((type) => {
            const selected = selectedTypes.includes(type.idTypeDechet);
            return (
              <TouchableOpacity
                key={type.idTypeDechet}
                style={[s.choice, selected && s.choiceSelected]}
                onPress={() => toggleType(type.idTypeDechet)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
              >
                <Text style={[s.choiceText, selected && s.choiceTextSelected]}>
                  {selected ? "✓  " : ""}{type.libelle}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <Text style={s.helper}>Aucune catégorie active n’est disponible actuellement.</Text>
      )}
      {selectedTypes.length > 0 ? (
        <Text style={s.helper}>{selectedTypes.length} catégorie(s) sélectionnée(s).</Text>
      ) : null}

      <Text style={s.label}>Description</Text>
      <TextInput
        multiline
        textAlignVertical="top"
        style={[s.input, s.textarea]}
        placeholder="Décrivez le dépôt, les déchets ou la situation observée…"
        value={description}
        onChangeText={setDescription}
        maxLength={5000}
      />

      <Text style={s.label}>Localisation (facultatif)</Text>
      <TextInput
        style={s.input}
        placeholder="Quartier, rue, point de repère…"
        value={locationLabel}
        onChangeText={setLocationLabel}
        maxLength={1000}
      />
      <TouchableOpacity style={s.secondary} onPress={locate} disabled={locating}>
        <Text style={s.secondaryText}>
          {locating
            ? "Localisation…"
            : coords
              ? "✓ Position enregistrée"
              : "⌖  Utiliser ma position actuelle"}
        </Text>
      </TouchableOpacity>

      <Text style={s.label}>Photo (facultatif)</Text>
      <TouchableOpacity style={s.photo} onPress={attach}>
        <Text style={s.photoText}>
          {photo ? "✓ " + (photo.fileName || "Photo jointe") : "＋  Ajouter une photo"}
        </Text>
      </TouchableOpacity>
      <Text style={s.helper}>
        JPEG, PNG ou WebP · 10 Mo maximum. Le fichier reste privé et passe par le backend.
      </Text>

      <TouchableOpacity
        style={[s.submit, busy && s.disabled]}
        onPress={submit}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.submitText}>Envoyer le signalement</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f6f8f5" },
  content: { padding: 23, paddingTop: 62, paddingBottom: 50 },
  back: { color: "#62816e", fontSize: 12, fontWeight: "700", marginBottom: 34 },
  kicker: { color: "#6b9578", fontSize: 9, letterSpacing: 2, fontWeight: "900" },
  title: { color: "#173c34", fontSize: 28, fontWeight: "900", marginTop: 9 },
  subtitle: {
    color: "#849188",
    fontSize: 12,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 22,
  },
  label: { color: "#40594b", fontSize: 11, fontWeight: "800", marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#e1e8e1",
    backgroundColor: "#fff",
    borderRadius: 11,
    paddingHorizontal: 13,
    minHeight: 48,
    color: "#243e31",
    fontSize: 12,
  },
  textarea: { minHeight: 130, paddingTop: 13 },
  loadingTypes: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 12 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    borderWidth: 1,
    borderColor: "#dce7dd",
    borderRadius: 18,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  choiceSelected: { borderColor: "#46765b", backgroundColor: "#e6f0e7" },
  choiceText: { color: "#597064", fontSize: 10, fontWeight: "700" },
  choiceTextSelected: { color: "#285b40" },
  typeError: {
    borderRadius: 10,
    backgroundColor: "#fff4ee",
    padding: 12,
    gap: 8,
  },
  typeErrorText: { color: "#985c43", fontSize: 11, lineHeight: 16 },
  retryText: { color: "#46765b", fontSize: 11, fontWeight: "900" },
  secondary: {
    height: 43,
    borderRadius: 10,
    marginTop: 10,
    backgroundColor: "#eaf2eb",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: "#46765b", fontSize: 11, fontWeight: "800" },
  photo: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#b8cbbd",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fbfcfa",
  },
  photoText: { color: "#507d60", fontSize: 11, fontWeight: "800" },
  helper: { color: "#a0aba2", fontSize: 9, lineHeight: 15, marginTop: 8 },
  submit: {
    height: 51,
    borderRadius: 11,
    backgroundColor: "#205347",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 27,
  },
  submitText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  disabled: { opacity: 0.6 },
});
