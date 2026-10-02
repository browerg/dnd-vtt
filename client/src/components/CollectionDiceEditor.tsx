import { DICE_RECIPES } from "../diceRecipes";
import { DICE_FINISH_OPTIONS, DICE_NUMBER_STYLE_OPTIONS, DICE_PATTERN_OPTIONS, type DiceCustomization } from "../diceCustomization";

export default function CollectionDiceEditor({ settings, onChange, name, onName, editing, full, busy, dirty, onSave, onEquip, onReset }: {
  settings: DiceCustomization; onChange: (settings: DiceCustomization) => void; name: string; onName: (name: string) => void;
  editing: boolean; full: boolean; busy: boolean; dirty: boolean; onSave: () => void; onEquip: () => void; onReset: () => void;
}) {
  const change = <K extends keyof DiceCustomization>(key: K, value: DiceCustomization[K]) => onChange({ ...settings, [key]: value });
  return <section className="workshop-controls" aria-label="Dice design controls">
    <header><h2>Make it yours</h2><p>Changes appear on your die as you work.</p></header>
    <details className="workshop-recipes"><summary>Start with a quick look</summary><div>{DICE_RECIPES.map(recipe => <button key={recipe.name} onClick={e => { onChange({ ...recipe.settings }); e.currentTarget.closest("details")?.removeAttribute("open"); }}><span className="recipe-colors" aria-hidden="true">{[recipe.settings.baseColor, recipe.settings.textColor, recipe.settings.edgeColor].map((color, i) => <i key={i} style={{ background: color }} />)}</span>{recipe.name}</button>)}</div></details>
    <fieldset><legend>Color & ink</legend>
      {([['baseColor', 'Base'], ['textColor', 'Numbers'], ['edgeColor', 'Edges']] as const).map(([key, label]) => <label className="workshop-color" key={key}><span>{label}</span><span><input type="color" aria-label={`${label} color`} value={settings[key]} onChange={e => change(key, e.target.value)} /><output>{settings[key].toUpperCase()}</output></span></label>)}
      <label>Number style<select value={settings.numberStyle} onChange={e => change("numberStyle", e.target.value as DiceCustomization["numberStyle"])}>{DICE_NUMBER_STYLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      {settings.numberStyle === "outlined" && <label className="workshop-color"><span>Outline</span><span><input type="color" aria-label="Outline color" value={settings.outlineColor} onChange={e => change("outlineColor", e.target.value)} /><output>{settings.outlineColor.toUpperCase()}</output></span></label>}
    </fieldset>
    <fieldset><legend>Surface</legend>
      <label>Pattern<select value={settings.pattern} onChange={e => change("pattern", e.target.value as DiceCustomization["pattern"])}>{DICE_PATTERN_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label>Finish<select value={settings.finish} onChange={e => change("finish", e.target.value as DiceCustomization["finish"])}>{DICE_FINISH_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label className="workshop-range"><span>Pattern strength <output>{Math.round(settings.patternStrength * 100)}%</output></span><input aria-label="Pattern strength" type="range" min="0.25" max="1" step="0.05" disabled={settings.pattern === "none"} value={settings.patternStrength} onChange={e => change("patternStrength", Number(e.target.value))} /></label>
      <label className="workshop-range"><span>Pattern scale <output>{settings.patternScale.toFixed(1)}×</output></span><input aria-label="Pattern scale" type="range" min="0.5" max="2.5" step="0.1" disabled={settings.pattern === "none"} value={settings.patternScale} onChange={e => change("patternScale", Number(e.target.value))} /></label>
    </fieldset>
    <div className="workshop-save"><label>Design name<input value={name} maxLength={24} placeholder="Name your dice" onChange={e => onName(e.target.value)} /></label>
      <div className="collection-actions"><button className="collection-primary" disabled={busy || !name.trim() || full || !dirty} onClick={onSave}>{busy ? "Working…" : editing ? "Update design" : "Save design"}</button><button disabled={busy} onClick={onEquip}>Equip dice</button></div>
      {full && <p>All five design spaces are filled. Edit an existing design or delete one to save a new one.</p>}
      <button className="collection-text-button" disabled={busy} onClick={onReset}>Reset appearance</button>
    </div>
  </section>;
}
