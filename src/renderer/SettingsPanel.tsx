import { useMemo, useState } from "react";
import type { GrokSettings, SettingsField } from "../shared/grok-settings";
import { SETTINGS_SECTIONS } from "../shared/grok-settings";
import type { ModelInfo } from "../shared/types";

const MODEL_KEYS = new Set<keyof GrokSettings>([
  "defaultModel",
  "webSearchModel",
  "sessionSummaryModel",
  "imageDescriptionModel",
  "forkSecondaryModel",
]);

function FieldControl({
  field,
  value,
  models,
  onChange,
}: {
  field: SettingsField;
  value: GrokSettings[keyof GrokSettings];
  models: ModelInfo[];
  onChange: (value: unknown) => void;
}) {
  if (MODEL_KEYS.has(field.key) && models.length > 0) {
    const current = String(value ?? "");
    const known = models.some((model) => model.modelId === current);
    const allowEmpty = field.key !== "defaultModel";
    return (
      <select className="chip settings-input" value={current} onChange={(event) => onChange(event.target.value)}>
        {allowEmpty ? <option value="">跟随默认</option> : null}
        {!known && current ? <option value={current}>{current}</option> : null}
        {models.map((model) => (
          <option key={model.modelId} value={model.modelId}>
            {model.name}
          </option>
        ))}
      </select>
    );
  }
  if (field.kind === "toggle") {
    return (
      <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
    );
  }
  if (field.kind === "select") {
    return (
      <select className="chip settings-input" value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.kind === "number") {
    const empty = value === null || value === undefined || Number.isNaN(Number(value));
    return (
      <input
        className="settings-input"
        type="number"
        min={field.min}
        max={field.max}
        placeholder={field.optional ? "默认" : undefined}
        value={empty ? "" : Number(value)}
        onChange={(event) => {
          const text = event.target.value;
          if (text === "") onChange(field.optional ? null : field.min ?? 0);
          else onChange(Number(text));
        }}
      />
    );
  }
  return (
    <input
      className="settings-input"
      type="text"
      placeholder={field.kind === "list" ? "逗号分隔" : undefined}
      value={String(value ?? "")}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function SettingsPanel({
  settings,
  models,
  onClose,
  onChange,
}: {
  settings: GrokSettings;
  models: ModelInfo[];
  onClose: () => void;
  onChange: (key: keyof GrokSettings, value: unknown) => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const sections = useMemo(() => {
    return SETTINGS_SECTIONS.map((section) => ({
      ...section,
      fields: needle
        ? section.fields.filter((field) =>
            `${section.title} ${field.label} ${field.hint} ${field.key}`.toLowerCase().includes(needle),
          )
        : section.fields,
    })).filter((section) => section.fields.length > 0);
  }, [needle]);

  return (
    <div className="settings-scrim" onClick={onClose}>
      <div className="settings-panel" onClick={(event) => event.stopPropagation()}>
        <header className="settings-head">
          <h2>设置</h2>
          <button className="icon-btn" type="button" onClick={onClose}>
            ×
          </button>
        </header>
        <p className="settings-lead">
          写入 ~/.grok/config.toml，与 grok build 共用。密钥、MCP、OIDC、marketplace 不会出现在这里。
        </p>
        <input
          className="settings-filter"
          type="search"
          value={query}
          placeholder="搜索设置"
          onChange={(event) => setQuery(event.target.value)}
        />
        {sections.map((section) => (
          <section className="settings-section" key={section.title}>
            <h3>{section.title}</h3>
            {section.fields.map((field) => (
              <label className="settings-row" key={field.key}>
                <span>
                  <strong>{field.label}</strong>
                  <em>{field.hint}</em>
                </span>
                <FieldControl
                  field={field}
                  value={settings[field.key]}
                  models={models}
                  onChange={(value) => onChange(field.key, value)}
                />
              </label>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
