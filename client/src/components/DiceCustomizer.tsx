import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import DiceBox from "@3d-dice/dice-box-threejs";
import { api } from "../api";
import { useAuth } from "../App";
import {
  DEFAULT_DICE_CUSTOMIZATION,
  DICE_FINISH_OPTIONS,
  DICE_NUMBER_STYLE_OPTIONS,
  DICE_PATTERN_OPTIONS,
  GLASS_TEST_MODES,
  setGlassTestMode,
  setGlassTestBrightness,
  setGlassTestGlow,
  type GlassTestMode,
  applyDiceBoxCustomization,
  decodeDiceCustomization,
  diceBoxAppearanceConfig,
  encodeDiceCustomization,
  type DiceCustomization,
  type DiceFinish,
  type DiceNumberStyle,
  type DicePattern,
} from "../diceCustomization";
import {
  getDiceTrailOptions,
  getDiceTrailStyle,
  previewDice,
  setDiceTrailStyle,
  type DiceTrailStyle,
} from "../dice3d";import "./DiceCustomizer.css";

const DICE_TYPES = [4, 6, 8, 10, 12, 20] as const;
const PREVIEW_ID = "dice-customizer-preview";
const MAX_PRESETS = 5;

type DiceSide = (typeof DICE_TYPES)[number];

type PreviewMesh = {
  position: { set: (x: number, y: number, z: number) => void };
  rotation: { x: number; y: number; z: number };
  castShadow: boolean;
};

type PreviewBox = DiceBox & {
  DiceFactory: { create: (type: string) => PreviewMesh | null };
  scene: {
    add: (mesh: PreviewMesh) => void;
    remove: (mesh: PreviewMesh) => void;
  };
  renderer: {
    render: (scene: unknown, camera: unknown) => void;
    dispose?: () => void;
  };
  camera: unknown;
  desk?: { visible: boolean };
};

interface DicePreset {
  id: number;
  name: string;
  theme: string;
  createdAt: string;
  updatedAt: string;
}

interface DiceRecipe {
  name: string;
  description: string;
  settings: DiceCustomization;
}

const DICE_RECIPES: DiceRecipe[] = [
  {
    name: "Emerald Relic",
    description: "Stained glass + copper ink",
    settings: {
      baseColor: "#0d5b46",
      textColor: "#ef9b6c",
      edgeColor: "#063126",
      outlineColor: "#3a160e",
      numberStyle: "outlined",
      finish: "glossy",
      pattern: "stainedglass",
      patternStrength: 0.9,
      patternScale: 1.2,
    },
  },
  {
    name: "Astral Gold",
    description: "Deep violet starfield",
    settings: {
      baseColor: "#2b1748",
      textColor: "#f3cf72",
      edgeColor: "#12091f",
      outlineColor: "#5e3908",
      numberStyle: "outlined",
      finish: "glossy",
      pattern: "astral",
      patternStrength: 0.95,
      patternScale: 1.2,
    },
  },
  {
    name: "Frostglass",
    description: "Ice crystal + pale ink",
    settings: {
      baseColor: "#8fcfe2",
      textColor: "#f7fbff",
      edgeColor: "#3d829c",
      outlineColor: "#315a68",
      numberStyle: "outlined",
      finish: "glossy",
      pattern: "ice",
      patternStrength: 0.82,
      patternScale: 1.1,
    },
  },
  {
    name: "Blood Marble",
    description: "Dark red polished stone",
    settings: {
      baseColor: "#721a25",
      textColor: "#f2d6b5",
      edgeColor: "#2d090e",
      outlineColor: "#4a080b",
      numberStyle: "outlined",
      finish: "metallic",
      pattern: "marble",
      patternStrength: 0.9,
      patternScale: 0.9,
    },
  },
  {
    name: "Obsidian Gold",
    description: "Black speckle + gold ink",
    settings: {
      baseColor: "#171719",
      textColor: "#e9be61",
      edgeColor: "#050506",
      outlineColor: "#5c3c0a",
      numberStyle: "outlined",
      finish: "metallic",
      pattern: "speckles",
      patternStrength: 0.75,
      patternScale: 1.5,
    },
  },
  {
    name: "Dragon Scale",
    description: "Forest metal + scale texture",
    settings: {
      baseColor: "#1a4a31",
      textColor: "#e6c873",
      edgeColor: "#07190f",
      outlineColor: "#4b3209",
      numberStyle: "outlined",
      finish: "metallic",
      pattern: "dragon",
      patternStrength: 0.95,
      patternScale: 1.3,
    },
  },
];

const patternLabel = (pattern: DicePattern) =>
  DICE_PATTERN_OPTIONS.find((option) => option.value === pattern)?.label ?? "Custom";

export default function DiceCustomizer() {
  const { user, setUser } = useAuth();
  const initial = useMemo(
    () => decodeDiceCustomization(user?.diceTheme) ?? DEFAULT_DICE_CUSTOMIZATION,
    [user?.diceTheme]
  );

  const [settings, setSettings] = useState<DiceCustomization>(initial);
  const [sides, setSides] = useState<DiceSide>(20);
  const [previewReady, setPreviewReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [trailStyle, setTrailStyle] = useState<DiceTrailStyle>(() => getDiceTrailStyle());
  const [trailPreviewing, setTrailPreviewing] = useState(false);

  const [presets, setPresets] = useState<DicePreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(true);
  const [presetBusy, setPresetBusy] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [editingPresetId, setEditingPresetId] = useState<number | null>(null);

  const boxRef = useRef<PreviewBox | null>(null);
  const meshRef = useRef<PreviewMesh | null>(null);
  const previewRequestRef = useRef(0);
  const previewChainRef = useRef<Promise<void>>(Promise.resolve());
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const dragRef = useRef({ active: false, pointerId: -1, x: 0, y: 0 });

  useEffect(() => {
    let disposed = false;
    const preview = new DiceBox(`#${PREVIEW_ID}`, {
      assetPath: "/assets/dice/",
      sounds: false,
      theme_surface: "green-felt",
      shadows: false,
      light_intensity: 1.05,
      gravity_multiplier: 400,
      baseScale: 76,
      strength: 0.8,
      ...diceBoxAppearanceConfig(initial),
    }) as PreviewBox;

    boxRef.current = preview;

    void preview
      .initialize()
      .then(() => {
        if (disposed) return;
        if (preview.desk) preview.desk.visible = false;
        setPreviewReady(true);

        const animate = (time: number) => {
          if (disposed) return;
          const last = lastFrameRef.current ?? time;
          const dt = Math.min((time - last) / 1000, 0.05);
          lastFrameRef.current = time;

          const mesh = meshRef.current;
          if (mesh && !dragRef.current.active) {
            mesh.rotation.y += dt * 0.34;
            mesh.rotation.x += dt * 0.055;
          }

          preview.renderer.render(preview.scene, preview.camera);
          animationFrameRef.current = window.requestAnimationFrame(animate);
        };

        animationFrameRef.current = window.requestAnimationFrame(animate);
      })
      .catch((cause) => {
        console.error("dice customizer preview failed to initialize", cause);
        if (!disposed) setError("The 3D dice preview could not start on this device.");
      });

    return () => {
      disposed = true;
      previewRequestRef.current += 1;
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      if (meshRef.current) {
        preview.scene.remove(meshRef.current);
        meshRef.current = null;
      }
      try {
        preview.clearDice();
        preview.renderer.dispose?.();
      } catch {
        // The renderer may still be initializing while the page is closing.
      }
      boxRef.current = null;
      document.getElementById(PREVIEW_ID)?.replaceChildren();
    };
  }, []);

  useEffect(() => {
    if (!previewReady || !boxRef.current) return;

    const requestId = ++previewRequestRef.current;
    const timer = window.setTimeout(() => {
      previewChainRef.current = previewChainRef.current
        .catch(() => undefined)
        .then(async () => {
          const preview = boxRef.current;
          if (!preview || requestId !== previewRequestRef.current) return;

          await applyDiceBoxCustomization(preview, settings);
          if (requestId !== previewRequestRef.current) return;

          if (meshRef.current) {
            preview.scene.remove(meshRef.current);
            meshRef.current = null;
          }

          const mesh = preview.DiceFactory.create(`d${sides}`);
          if (!mesh) throw new Error(`Could not create d${sides} preview mesh.`);

          mesh.position.set(0, 0, 0);
          mesh.rotation.x = -0.36;
          mesh.rotation.y = 0.58;
          mesh.rotation.z = 0.08;
          mesh.castShadow = false;
          preview.scene.add(mesh);
          meshRef.current = mesh;
          preview.renderer.render(preview.scene, preview.camera);
        })
        .catch((cause) => {
          console.error("dice customizer preview failed", cause);
          setError("The 3D dice preview hit an error. Try another setting or reload the page.");
        });
    }, 90);

    return () => window.clearTimeout(timer);
  }, [previewReady, settings, sides]);

  useEffect(() => {
    let cancelled = false;

    void api<{ presets: DicePreset[] }>("/api/auth/me/dice-presets")
      .then((response) => {
        if (!cancelled) setPresets(response.presets);
      })
      .catch((cause) => {
        console.error("failed to load dice presets", cause);
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load My Dice.");
      })
      .finally(() => {
        if (!cancelled) setPresetsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const clearMessages = () => {
    setNotice("");
    setError("");
  };

  const updateColor = (
    key: "baseColor" | "textColor" | "edgeColor" | "outlineColor",
    value: string
  ) => {
    clearMessages();
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const updateFinish = (finish: DiceFinish) => {
    clearMessages();
    setSettings((current) => ({ ...current, finish }));
  };

  const updatePattern = (pattern: DicePattern) => {
    clearMessages();
    setSettings((current) => ({ ...current, pattern }));
  };

  const updateNumberStyle = (numberStyle: DiceNumberStyle) => {
    clearMessages();
    setSettings((current) => ({ ...current, numberStyle }));
  };

  const updatePatternStrength = (patternStrength: number) => {
    clearMessages();
    setSettings((current) => ({ ...current, patternStrength }));
  };

  const updatePatternScale = (patternScale: number) => {
    clearMessages();
    setSettings((current) => ({ ...current, patternScale }));
  };

  const applyRecipe = (recipe: DiceRecipe) => {
    setSettings({ ...recipe.settings });
    setNotice(`Loaded ${recipe.name}. Fine-tune anything below, then equip or save it.`);
    setError("");
  };

  const reset = () => {
    setSettings({ ...DEFAULT_DICE_CUSTOMIZATION });
    setSides(20);
    setNotice("Reset locally. Equip or save this version when you're ready.");
    setError("");
  };

  const equipTheme = async (theme: string, successMessage: string) => {
    await api("/api/auth/me/dice", {
      method: "PUT",
      body: JSON.stringify({ theme }),
    });
    if (user) setUser({ ...user, diceTheme: theme });
    setNotice(successMessage);
  };

  const equipCurrent = async () => {
    setSaving(true);
    clearMessages();

    try {
      await equipTheme(
        encodeDiceCustomization(settings),
        "Equipped — this appearance now follows your whole dice set and your live rolls."
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not equip your dice.");
    } finally {
      setSaving(false);
    }
  };

  const savePreset = async () => {
    const name = presetName.trim();
    if (!name) {
      setError("Give this dice preset a name first.");
      return;
    }

    setPresetBusy(true);
    clearMessages();
    const theme = encodeDiceCustomization(settings);

    try {
      if (editingPresetId === null) {
        const response = await api<{ preset: DicePreset }>("/api/auth/me/dice-presets", {
          method: "POST",
          body: JSON.stringify({ name, theme }),
        });
        setPresets((current) => [...current, response.preset]);
        setEditingPresetId(response.preset.id);
        setPresetName(response.preset.name);
        setNotice(`Saved “${response.preset.name}” to My Dice.`);
      } else {
        const response = await api<{ preset: DicePreset }>(
          `/api/auth/me/dice-presets/${editingPresetId}`,
          {
            method: "PUT",
            body: JSON.stringify({ name, theme }),
          }
        );
        setPresets((current) =>
          current.map((preset) => (preset.id === response.preset.id ? response.preset : preset))
        );
        setPresetName(response.preset.name);
        setNotice(`Updated “${response.preset.name}”.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this preset.");
    } finally {
      setPresetBusy(false);
    }
  };

  const editPreset = (preset: DicePreset) => {
    const customization = decodeDiceCustomization(preset.theme);
    if (!customization) {
      setError("That saved dice preset uses an unsupported format.");
      return;
    }

    setSettings(customization);
    setPresetName(preset.name);
    setEditingPresetId(preset.id);
    setNotice(`Editing “${preset.name}”.`);
    setError("");
  };

  const equipPreset = async (preset: DicePreset) => {
    const customization = decodeDiceCustomization(preset.theme);
    if (!customization) {
      setError("That saved dice preset uses an unsupported format.");
      return;
    }

    setPresetBusy(true);
    setSettings(customization);
    clearMessages();

    try {
      await equipTheme(preset.theme, `Equipped “${preset.name}”.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not equip this preset.");
    } finally {
      setPresetBusy(false);
    }
  };

  const deletePreset = async (preset: DicePreset) => {
    if (!window.confirm(`Delete “${preset.name}” from My Dice?`)) return;

    setPresetBusy(true);
    clearMessages();

    try {
      await api(`/api/auth/me/dice-presets/${preset.id}`, { method: "DELETE" });
      setPresets((current) => current.filter((item) => item.id !== preset.id));
      if (editingPresetId === preset.id) {
        setEditingPresetId(null);
        setPresetName("");
      }
      setNotice(`Deleted “${preset.name}”.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete this preset.");
    } finally {
      setPresetBusy(false);
    }
  };

  const startNewPreset = () => {
    setEditingPresetId(null);
    setPresetName("");
    setNotice("Ready to save the current appearance as a new preset.");
    setError("");
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const mesh = meshRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId || !mesh) return;

    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.x = event.clientX;
    drag.y = event.clientY;

    mesh.rotation.y += dx * 0.012;
    mesh.rotation.x += dy * 0.012;
  };

  const endPointerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current.active = false;
    dragRef.current.pointerId = -1;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const atPresetLimit = presets.length >= MAX_PRESETS && editingPresetId === null;
  const patternDisabled = settings.pattern === "none";
  const trailOptions = getDiceTrailOptions();

  // Trail ownership comes from the Emporium, not from the build mode. It used
  // to key off import.meta.env.DEV, which meant every trail was selectable and
  // players saw a "DEV · ALL UNLOCKED" badge whenever the table was hosted in
  // dev — and the picker never checked ownership at all, so the prices were
  // decorative.
  const [trailShop, setTrailShop] = useState<Record<string, { owned: boolean; price: number }>>({});

  useEffect(() => {
    let cancelled = false;
    api<{ items?: { type: string; effect: string; price: number; owned: boolean }[] }>("/api/shop")
      .then((response) => {
        if (cancelled) return;
        const owned: Record<string, { owned: boolean; price: number }> = {};
        for (const item of response.items ?? []) {
          if (item.type === "dice-trail") {
            owned[item.effect] = { owned: !!item.owned, price: Number(item.price) || 0 };
          }
        }
        setTrailShop(owned);
      })
      // If the shop is unreachable the map stays empty, which locks the paid
      // trails rather than handing them out.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const trailEntry = (style: DiceTrailStyle) => trailShop[style];
  const trailOwned = (style: DiceTrailStyle) => trailEntry(style)?.owned === true;

  // A trail saved before ownership was enforced must not keep applying.
  useEffect(() => {
    if (!Object.keys(trailShop).length) return;
    if (trailOwned(trailStyle)) return;
    setTrailStyle("aura");
    setDiceTrailStyle("aura");
  }, [trailShop]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectTrail = (style: DiceTrailStyle) => {
    const label = trailOptions.find((option) => option.value === style)?.label ?? "This dice trail";
    if (!trailOwned(style)) {
      setNotice("");
      setError(`${label} is an Emporium cosmetic. Unlock it in the shop to equip it.`);
      return;
    }
    setTrailStyle(style);
    setDiceTrailStyle(style);
    setNotice(`Selected ${label}.`);
    setError("");
  };

  // TEMPORARY — glass material experiment. Rolls the same die under each
  // treatment so a look can be chosen before anything is built on it.
  const [glassMode, setGlassMode] = useState<GlassTestMode>("off");
  const [glassBrightness, setGlassBrightness] = useState(1);
  const [glassGlow, setGlassGlow] = useState(0);

  const rollGlassPreview = async (label: string) => {
    setTrailPreviewing(true);
    clearMessages();
    try {
      await previewDice(encodeDiceCustomization(settings));
      setNotice(label);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not roll that preview.");
    } finally {
      setTrailPreviewing(false);
    }
  };

  const tryGlassMode = async (mode: GlassTestMode) => {
    setGlassMode(mode);
    setGlassTestMode(mode);
    setTrailPreviewing(true);
    clearMessages();
    try {
      // Re-applying the customization rebuilds the materials through the wrap.
      await previewDice(encodeDiceCustomization(settings));
      setNotice(
        `Rolled ${GLASS_TEST_MODES.find((m) => m.value === mode)?.label ?? mode}. Compare, then tell me which reads as glass.`
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not roll that preview.");
    } finally {
      setTrailPreviewing(false);
    }
  };

  const previewSelectedTrail = async () => {
    setTrailPreviewing(true);
    clearMessages();

    try {
      setDiceTrailStyle(trailStyle);
      await previewDice(encodeDiceCustomization(settings));
      setNotice(
        `Previewed ${trailOptions.find((option) => option.value === trailStyle)?.label ?? "dice trail"}.`
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not preview this dice trail.");
    } finally {
      setTrailPreviewing(false);
    }
  };

  return (
    <section className="card dice-customizer-card">
      <div className="dice-customizer-heading">
        <div>
          <h3>Dice customizer</h3>
          <p className="muted small">
            Layer color, pattern, edges and ink into one look, then keep up to five versions in My Dice.
          </p>
        </div>
        <span className="dice-customizer-live">LIVE 3D</span>
      </div>

      <div
        className={`dice-customizer-preview${dragging ? " dragging" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointerDrag}
        onPointerCancel={endPointerDrag}
        role="img"
        aria-label={`Floating 3D D${sides} preview. Drag to rotate the die.`}
      >
        <span id={PREVIEW_ID} className="dice-customizer-canvas" aria-hidden />
        {!previewReady && <span className="dice-customizer-loading">Loading 3D die…</span>}
        <span className="dice-customizer-inspect">Drag to spin</span>
        <span className="dice-customizer-auto">Slow auto-rotate</span>
      </div>

      <div className="dice-customizer-types" aria-label="Preview die type">
        {DICE_TYPES.map((dieSides) => (
          <button
            key={dieSides}
            type="button"
            className={`die-btn${sides === dieSides ? " selected" : ""}`}
            onClick={() => setSides(dieSides)}
            aria-pressed={sides === dieSides}
          >
            D{dieSides}
          </button>
        ))}
      </div>

      <div className="dice-style-heading">
        <div>
          <h4>Quick looks</h4>
          <p className="muted small">Starting points made from the same controls below.</p>
        </div>
        <span className="dice-style-badge">V3 PATTERNS</span>
      </div>

      <div className="dice-style-recipes">
        {DICE_RECIPES.map((recipe) => (
          <button
            key={recipe.name}
            type="button"
            className="dice-style-recipe"
            onClick={() => applyRecipe(recipe)}
          >
            <span className="dice-style-recipe-swatches" aria-hidden>
              <i style={{ background: recipe.settings.baseColor }} />
              <i style={{ background: recipe.settings.textColor }} />
              <i style={{ background: recipe.settings.edgeColor }} />
            </span>
            <span>
              <strong>{recipe.name}</strong>
              <small>{recipe.description}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="dice-control-section">
        <div className="dice-control-section-title">
          <h4>Color & ink</h4>
          <span>Face, edge and number treatment</span>
        </div>

        <div className="dice-customizer-controls dice-customizer-color-controls">
          <label className="dice-customizer-field">
            <span>
              <strong>Base color</strong>
              <small>{settings.baseColor.toUpperCase()}</small>
            </span>
            <input
              type="color"
              value={settings.baseColor}
              onChange={(event) => updateColor("baseColor", event.target.value)}
              aria-label="Dice base color"
            />
          </label>

          <label className="dice-customizer-field">
            <span>
              <strong>Number color</strong>
              <small>{settings.textColor.toUpperCase()}</small>
            </span>
            <input
              type="color"
              value={settings.textColor}
              onChange={(event) => updateColor("textColor", event.target.value)}
              aria-label="Dice number color"
            />
          </label>

          <label className="dice-customizer-field">
            <span>
              <strong>Edge color</strong>
              <small>{settings.edgeColor.toUpperCase()}</small>
            </span>
            <input
              type="color"
              value={settings.edgeColor}
              onChange={(event) => updateColor("edgeColor", event.target.value)}
              aria-label="Dice edge color"
            />
          </label>

          <label className="dice-customizer-field dice-customizer-select-field">
            <span>
              <strong>Number style</strong>
              <small>{settings.numberStyle === "outlined" ? "Outlined ink" : "Clean ink"}</small>
            </span>
            <select
              value={settings.numberStyle}
              onChange={(event) => updateNumberStyle(event.target.value as DiceNumberStyle)}
              aria-label="Dice number style"
            >
              {DICE_NUMBER_STYLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={`dice-customizer-field${settings.numberStyle === "clean" ? " disabled" : ""}`}>
            <span>
              <strong>Number outline</strong>
              <small>
                {settings.numberStyle === "clean" ? "Enable Outlined above" : settings.outlineColor.toUpperCase()}
              </small>
            </span>
            <input
              type="color"
              value={settings.outlineColor}
              onChange={(event) => updateColor("outlineColor", event.target.value)}
              aria-label="Dice number outline color"
              disabled={settings.numberStyle === "clean"}
            />
          </label>
        </div>
      </div>

      <div className="dice-control-section">
        <div className="dice-control-section-title">
          <h4>Surface</h4>
          <span>Real DiceBox textures and material finish</span>
        </div>

        <div className="dice-customizer-controls dice-customizer-surface-controls">
          <label className="dice-customizer-field dice-customizer-select-field">
            <span>
              <strong>Pattern</strong>
              <small>{patternLabel(settings.pattern)}</small>
            </span>
            <select
              value={settings.pattern}
              onChange={(event) => updatePattern(event.target.value as DicePattern)}
              aria-label="Dice surface pattern"
            >
              {DICE_PATTERN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="dice-customizer-field dice-customizer-select-field">
            <span>
              <strong>Finish</strong>
              <small>Real renderer material</small>
            </span>
            <select
              value={settings.finish}
              onChange={(event) => updateFinish(event.target.value as DiceFinish)}
              aria-label="Dice finish"
            >
              {DICE_FINISH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className={`dice-customizer-field dice-customizer-range${patternDisabled ? " disabled" : ""}`}>
            <span>
              <strong>Pattern strength</strong>
              <small>{Math.round(settings.patternStrength * 100)}%</small>
            </span>
            <input
              type="range"
              min="25"
              max="100"
              step="5"
              value={Math.round(settings.patternStrength * 100)}
              onChange={(event) => updatePatternStrength(Number(event.target.value) / 100)}
              aria-label="Dice pattern strength"
              disabled={patternDisabled}
            />
          </label>

          <label className={`dice-customizer-field dice-customizer-range${patternDisabled ? " disabled" : ""}`}>
            <span>
              <strong>Pattern scale</strong>
              <small>{settings.patternScale.toFixed(1)}×</small>
            </span>
            <input
              type="range"
              min="50"
              max="250"
              step="10"
              value={Math.round(settings.patternScale * 100)}
              onChange={(event) => updatePatternScale(Number(event.target.value) / 100)}
              aria-label="Dice pattern scale"
              disabled={patternDisabled}
            />
          </label>
        </div>
      </div>

      <div className="dice-control-section dice-trail-shop-section">
        <div className="dice-control-section-title">
          <div>
            <h4>Dice trails</h4>
            <span>Cosmetic effects that follow your dice through the roll</span>
          </div>
        </div>

        <div className="dice-trail-shop-grid">
          {trailOptions.map((option) => {
            const selected = trailStyle === option.value;
            const entry = trailEntry(option.value);
            const owned = trailOwned(option.value);
            const price = entry?.price ?? 0;

            return (
              <button
                key={option.value}
                type="button"
                className={`dice-trail-shop-card${selected ? " selected" : ""}${owned ? "" : " locked"}`}
                onClick={() => selectTrail(option.value)}
                aria-pressed={selected}
                title={owned ? undefined : `Unlock ${option.label} in the Emporium`}
              >
                <span className={`dice-trail-orb dice-trail-orb-${option.value}`} aria-hidden />
                <span className="dice-trail-shop-copy">
                  <strong>{option.label}</strong>
                  <small>
                    {price === 0 ? "Starter cosmetic" : owned ? "Unlocked" : "Emporium cosmetic"}
                  </small>
                </span>
                <span className={`dice-trail-status${selected ? " selected" : ""}`}>
                  {selected ? "EQUIPPED" : owned ? (price === 0 ? "FREE" : "OWNED") : `${price} VC`}
                </span>
              </button>
            );
          })}
        </div>

        <div className="dice-trail-preview-row">
          <div>
            <strong>Test the selected trail</strong>
            <span className="muted small">
              Throws a live 3D preview using your current dice appearance.
            </span>
          </div>
          <button
            type="button"
            className="ghost"
            onClick={() => void previewSelectedTrail()}
            disabled={trailPreviewing}
          >
            {trailPreviewing ? "Rolling…" : "Preview trail"}
          </button>
        </div>

        <p className="muted small dice-trail-dev-note">
          Aura Glow is the starter trail. The rest unlock through The Emporium.
        </p>

        {/* TEMPORARY — glass material experiment. Remove once a look is picked. */}
        <div className="dice-control-section glass-test-section">
          <div className="dice-control-section-title">
            <div>
              <h4>Glass test</h4>
              <span>
                Today's glossy finish is opaque — low roughness, no transparency. Roll each and
                say which one actually reads as glass.
              </span>
            </div>
          </div>
          <div className="glass-test-grid">
            {GLASS_TEST_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                className={`glass-test-card${glassMode === mode.value ? " selected" : ""}`}
                onClick={() => void tryGlassMode(mode.value)}
                disabled={trailPreviewing}
                aria-pressed={glassMode === mode.value}
              >
                <strong>{mode.label}</strong>
                <small>{mode.blurb}</small>
              </button>
            ))}
          </div>

          <div className="glass-test-sliders">
            <label>
              <span>
                Light intensity <b>{(0.7 * glassBrightness).toFixed(2)}</b>
                <small>
                  Now drives the scene lights, which actually move. The first attempt scaled the
                  environment map — and this scene never loads one, so it did nothing. 0.7 is the
                  stock value, so 1.0× here is unchanged.
                </small>
              </span>
              <input
                type="range"
                min={0}
                max={4}
                step={0.25}
                value={glassBrightness}
                disabled={trailPreviewing}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setGlassBrightness(value);
                  setGlassTestBrightness(value);
                }}
                onPointerUp={() => void rollGlassPreview(`Brightness ${glassBrightness.toFixed(1)}×.`)}
                onKeyUp={() => void rollGlassPreview(`Brightness ${glassBrightness.toFixed(1)}×.`)}
              />
            </label>

            <label>
              <span>
                Glowing numbers <b>{glassGlow === 0 ? "off" : `${glassGlow.toFixed(1)}×`}</b>
                <small>
                  Now masked to the glyphs only, so the body should stay put instead of the whole
                  die washing out. Note there is no bloom pass in this renderer, so this brightens
                  the digits rather than making them halo.
                </small>
              </span>
              <input
                type="range"
                min={0}
                max={3}
                step={0.25}
                value={glassGlow}
                disabled={trailPreviewing}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setGlassGlow(value);
                  setGlassTestGlow(value);
                }}
                onPointerUp={() =>
                  void rollGlassPreview(glassGlow === 0 ? "Glow off." : `Glow ${glassGlow.toFixed(1)}×.`)
                }
                onKeyUp={() =>
                  void rollGlassPreview(glassGlow === 0 ? "Glow off." : `Glow ${glassGlow.toFixed(1)}×.`)
                }
              />
            </label>
          </div>
        </div>
      </div>
      <div className="dice-customizer-actions">
        <button type="button" className="ghost" onClick={reset} disabled={saving || presetBusy}>
          Reset
        </button>
        <button type="button" className="primary" onClick={equipCurrent} disabled={saving || presetBusy}>
          {saving ? "Equipping…" : "Equip current dice"}
        </button>
      </div>

      <div className="dice-preset-divider" />

      <div className="dice-preset-heading">
        <div>
          <h4>My Dice</h4>
          <p className="muted small">Your personal saved dice shelf.</p>
        </div>
        <span className="dice-preset-count">{presets.length} / {MAX_PRESETS}</span>
      </div>

      <div className="dice-preset-save-row">
        <label className="dice-preset-name-field">
          <span>{editingPresetId === null ? "Dice name" : "Editing name"}</span>
          <input
            type="text"
            value={presetName}
            maxLength={24}
            placeholder="e.g. Emerald Relic"
            onChange={(event) => setPresetName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !presetBusy && !atPresetLimit) void savePreset();
            }}
          />
        </label>

        <div className="dice-preset-save-actions">
          {editingPresetId !== null && (
            <button type="button" className="ghost" onClick={startNewPreset} disabled={presetBusy}>
              New
            </button>
          )}
          <button
            type="button"
            className="primary"
            onClick={savePreset}
            disabled={presetBusy || atPresetLimit}
          >
            {presetBusy
              ? "Saving…"
              : editingPresetId === null
                ? atPresetLimit
                  ? "5 / 5 saved"
                  : "Save to My Dice"
                : "Update preset"}
          </button>
        </div>
      </div>

      {presetsLoading ? (
        <p className="muted small dice-preset-loading">Loading My Dice…</p>
      ) : presets.length === 0 ? (
        <div className="dice-preset-empty">
          <strong>No saved dice yet.</strong>
          <span>Design a set above, name it, and save your first preset.</span>
        </div>
      ) : (
        <div className="dice-preset-grid">
          {presets.map((preset) => {
            const customization = decodeDiceCustomization(preset.theme);
            const equipped = user?.diceTheme === preset.theme;
            return (
              <article
                key={preset.id}
                className={`dice-preset-card${editingPresetId === preset.id ? " editing" : ""}`}
              >
                <div className="dice-preset-card-top">
                  <div>
                    <strong>{preset.name}</strong>
                    <span>
                      {customization
                        ? `${patternLabel(customization.pattern)} · ${customization.finish}`
                        : "Custom"}
                    </span>
                  </div>
                  {equipped && <span className="dice-preset-equipped">EQUIPPED</span>}
                </div>

                <div className="dice-preset-swatches" aria-hidden>
                  <span
                    className="dice-preset-swatch"
                    style={{ background: customization?.baseColor ?? "transparent" }}
                  />
                  <span
                    className="dice-preset-swatch"
                    style={{ background: customization?.textColor ?? "transparent" }}
                  />
                  <span
                    className="dice-preset-swatch"
                    style={{ background: customization?.edgeColor ?? "transparent" }}
                  />
                  {customization?.pattern && customization.pattern !== "none" && (
                    <span className="dice-preset-pattern-label">{patternLabel(customization.pattern)}</span>
                  )}
                </div>

                <div className="dice-preset-card-actions">
                  <button type="button" onClick={() => editPreset(preset)} disabled={presetBusy}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => void equipPreset(preset)}
                    disabled={presetBusy || equipped}
                  >
                    {equipped ? "Equipped" : "Equip"}
                  </button>
                  <button
                    type="button"
                    className="dice-preset-delete"
                    onClick={() => void deletePreset(preset)}
                    disabled={presetBusy}
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {notice && <p className="muted small dice-customizer-message">{notice}</p>}
      {error && <div className="error dice-customizer-message">{error}</div>}
    </section>
  );
}

