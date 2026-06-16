import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "@/lib/api/settings";
import { groupThousands } from "@/lib/format/tokens";
import type { Preferences, User } from "@/lib/types";
import {
  BevelButton,
  RetroSelect,
  Window,
  retroToast,
} from "@/components/retro";

// Phase 12 Plan 04 — SETT-06. Regional formats: four selects + a LOCAL live
// preview. Phase 12 only WRITES preferences (partial PATCH, dirty fields only);
// Phase 15 owns the consumption hooks — there is intentionally NO format read
// hook here. The preview is computed inline from the pending RHF values so the
// user sees the effect of a change BEFORE saving (resolved OQ3).
//
// Option VALUEs are the exact tokens persisted to the backend (A1/A2) — Phase 15
// read-hooks MUST bind to these same strings (recorded in 12-04-SUMMARY).

const DATE_OPTIONS = [
  "YYYY-MM-DD",
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "DD.MM.YYYY",
] as const;

// Each select's VALUE is the persisted token; the visible label is human copy.
const TIME_OPTIONS: { value: string; label: string }[] = [
  { value: "HH:mm", label: "24-hour (14:32)" },
  { value: "h:mm A", label: "12-hour (2:32 PM)" },
];
const THOUSAND_OPTIONS: { value: string; label: string }[] = [
  { value: " ", label: "Space ( )" },
  { value: ",", label: "Comma (,)" },
  { value: ".", label: "Period (.)" },
  { value: "", label: "None" },
];
const DECIMAL_OPTIONS: { value: string; label: string }[] = [
  { value: ".", label: "Period (.)" },
  { value: ",", label: "Comma (,)" },
];

const formatsSchema = z
  .object({
    date_format: z.string(),
    time_format: z.string(),
    thousand_separator: z.string(),
    decimal_separator: z.string(),
  })
  .refine((v) => v.thousand_separator !== v.decimal_separator, {
    // Mirrors the backend 400 (entity.go:252). Attached to thousand_separator;
    // both selects get the danger treatment via the shared `conflict` flag below.
    path: ["thousand_separator"],
    message: "separators-equal",
  });

type FormatsForm = z.infer<typeof formatsSchema>;

// Fixed sample instant for the preview (13 June 2026, 14:32).
const SAMPLE = { y: 2026, mo: 6, d: 13, h: 14, mi: 32 };
const SAMPLE_NUMBER = { int: "1234567", frac: "89" };

const pad = (n: number) => String(n).padStart(2, "0");

function formatDate(token: string): string {
  const { y, mo, d } = SAMPLE;
  switch (token) {
    case "DD/MM/YYYY":
      return `${pad(d)}/${pad(mo)}/${y}`;
    case "MM/DD/YYYY":
      return `${pad(mo)}/${pad(d)}/${y}`;
    case "DD.MM.YYYY":
      return `${pad(d)}.${pad(mo)}.${y}`;
    default: // "YYYY-MM-DD"
      return `${y}-${pad(mo)}-${pad(d)}`;
  }
}

function formatTime(token: string): string {
  const { h, mi } = SAMPLE;
  if (token === "h:mm A") {
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${pad(mi)} ${period}`;
  }
  return `${pad(h)}:${pad(mi)}`;
}

function formatNumber(thousand: string, decimal: string): string {
  const grouped = groupThousands(SAMPLE_NUMBER.int, thousand || "");
  return `${grouped}${decimal}${SAMPLE_NUMBER.frac}`;
}

export function RegionalFormatsPage() {
  const { t } = useLingui();
  const queryClient = useQueryClient();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => settingsApi.getMe(),
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, dirtyFields, isSubmitting },
  } = useForm<FormatsForm>({
    resolver: zodResolver(formatsSchema),
    values: {
      date_format: me.data?.date_format ?? "YYYY-MM-DD",
      time_format: me.data?.time_format ?? "HH:mm",
      thousand_separator: me.data?.thousand_separator ?? " ",
      decimal_separator: me.data?.decimal_separator ?? ",",
    },
  });

  // Once ME arrives, re-baseline so dirtyFields tracks against the loaded values
  // (not the initial defaults) — without this the first PATCH could include
  // fields the user never touched.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-baseline only when ME data arrives; reset is stable (react-hook-form) and intentionally excluded.
  useEffect(() => {
    if (me.data) {
      reset({
        date_format: me.data.date_format ?? "YYYY-MM-DD",
        time_format: me.data.time_format ?? "HH:mm",
        thousand_separator: me.data.thousand_separator ?? " ",
        decimal_separator: me.data.decimal_separator ?? ",",
      });
    }
  }, [me.data]);

  const values = watch();
  const conflict = values.thousand_separator === values.decimal_separator;

  const mutation = useMutation({
    mutationFn: (body: Partial<Preferences>) =>
      settingsApi.updatePreferences(body),
    onSuccess: (_user: User) => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      retroToast.success(t`Changes saved.`);
    },
  });

  const submit = handleSubmit((vals) => {
    // Partial PATCH: only fields the user actually changed (dirtyFields).
    const body: Partial<Preferences> = {};
    (Object.keys(dirtyFields) as (keyof FormatsForm)[]).forEach((k) => {
      body[k] = vals[k];
    });
    if (Object.keys(body).length === 0) {
      retroToast.success(t`Changes saved.`);
      return;
    }
    mutation.mutate(body);
  });

  const separatorError = errors.thousand_separator ? (
    <Trans>Thousand and decimal separators must be different.</Trans>
  ) : undefined;

  return (
    <Window
      title={<Trans>Regional Formats</Trans>}
      bodyClassName="grid gap-sp-4 p-sp-4"
    >
      <form onSubmit={submit} className="grid gap-sp-4" noValidate>
        <div className="grid gap-sp-4 sm:grid-cols-2">
          <RetroSelect
            label={<Trans>Date format</Trans>}
            {...register("date_format")}
          >
            {DATE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </RetroSelect>
          <RetroSelect
            label={<Trans>Time format</Trans>}
            {...register("time_format")}
          >
            {TIME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </RetroSelect>
        </div>

        <div className="grid gap-sp-4 sm:grid-cols-2">
          <RetroSelect
            label={<Trans>Thousand separator</Trans>}
            error={separatorError}
            {...register("thousand_separator")}
          >
            {THOUSAND_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </RetroSelect>
          <RetroSelect
            label={<Trans>Decimal separator</Trans>}
            // Shared danger treatment when conflicting (the message lives on the
            // thousand field; this select just flips to the danger border).
            error={
              conflict && errors.thousand_separator ? (
                <span className="sr-only">conflict</span>
              ) : undefined
            }
            {...register("decimal_separator")}
          >
            {DECIMAL_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </RetroSelect>
        </div>

        {/* Live preview — recomputed locally from pending RHF values (no backend,
            no read-hook). mono 12px tabular-nums (UI-SPEC §6). */}
        <div
          data-testid="formats-preview"
          className="grid gap-sp-1 border-2 border-border-ink bg-bg-panel-2 p-sp-3 mono text-12 tabular-nums text-fg-ink bevel-sunken"
        >
          <div className="flex gap-sp-3">
            <span className="w-[64px] text-fg-muted">
              <Trans>Date</Trans>
            </span>
            <span>{formatDate(values.date_format)}</span>
          </div>
          <div className="flex gap-sp-3">
            <span className="w-[64px] text-fg-muted">
              <Trans>Time</Trans>
            </span>
            <span>{formatTime(values.time_format)}</span>
          </div>
          <div className="flex gap-sp-3">
            <span className="w-[64px] text-fg-muted">
              <Trans>Number</Trans>
            </span>
            <span>
              {formatNumber(
                values.thousand_separator,
                values.decimal_separator,
              )}
            </span>
          </div>
        </div>

        <div className="flex justify-end">
          <BevelButton
            type="submit"
            variant="primary"
            disabled={isSubmitting || mutation.isPending}
          >
            <Trans>Save changes</Trans>
          </BevelButton>
        </div>
      </form>
    </Window>
  );
}
