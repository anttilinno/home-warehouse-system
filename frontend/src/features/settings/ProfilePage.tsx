import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HttpError } from "@/lib/api";
import { settingsApi } from "@/lib/api/settings";
import {
  BevelButton,
  RetroInput,
  Window,
  retroToast,
} from "@/components/retro";
import { AvatarUploader } from "./AvatarUploader";

// Phase 12 Plan 03 — ProfilePage (SETT-02). One blue Window "PROFILE": the
// AvatarUploader block on top, then an RHF+zod name/email form (mirrors
// SecurityPage's password form structure). The PATCH body is built from
// RHF formState.dirtyFields ONLY, so an untouched email is never sent —
// CONTEXT constraint 3 / Pitfall 2 (partial PATCH). An email conflict (409
// or 400) surfaces an inline danger band, NOT a toast (SecurityPage band
// pattern); any other error falls back to a danger toast.

const profileSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email(),
});

type ProfileForm = z.infer<typeof profileSchema>;

export function ProfilePage() {
  const { t } = useLingui();
  const queryClient = useQueryClient();
  // Inline band shown when the backend rejects the new email (409/400).
  const [emailTaken, setEmailTaken] = useState(false);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => settingsApi.getMe(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: me.data
      ? { full_name: me.data.full_name, email: me.data.email }
      : undefined,
  });

  const update = useMutation({
    mutationFn: (body: { full_name?: string; email?: string }) =>
      settingsApi.updateMe(body),
    onSuccess: () => {
      retroToast.success(t`Saved.`);
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const submit = handleSubmit(async (values) => {
    setEmailTaken(false);
    // Partial PATCH: send only the fields the user actually touched. An
    // untouched email must never reach the wire (CONTEXT constraint 3).
    const body: { full_name?: string; email?: string } = {};
    if (dirtyFields.full_name) body.full_name = values.full_name;
    if (dirtyFields.email) body.email = values.email;
    // Nothing changed — no request.
    if (Object.keys(body).length === 0) return;
    try {
      await update.mutateAsync(body);
      // Re-baseline the form so the next edit's dirty set is fresh.
      reset(values);
    } catch (err) {
      if (
        err instanceof HttpError &&
        (err.status === 409 || err.status === 400)
      ) {
        setEmailTaken(true);
        return;
      }
      retroToast.error(t`Couldn't save. Try again.`);
    }
  });

  return (
    <Window title={<Trans>Profile</Trans>} bodyClassName="p-sp-4">
      <div className="mx-auto grid max-w-[560px] gap-sp-5">
        <AvatarUploader />

        {emailTaken && (
          <p
            role="alert"
            className="border-2 border-danger bg-danger-bg px-sp-3 py-sp-2 text-[13px] font-semibold text-danger"
          >
            <Trans>That email is already in use.</Trans>
          </p>
        )}

        <form onSubmit={submit} className="grid gap-sp-4" noValidate>
          <RetroInput
            label={<Trans>Full name</Trans>}
            error={
              errors.full_name && <Trans>Enter your name.</Trans>
            }
            {...register("full_name")}
          />
          <RetroInput
            label={<Trans>Email</Trans>}
            type="email"
            mono
            error={errors.email && <Trans>Enter a valid email.</Trans>}
            {...register("email")}
          />
          <div className="flex justify-end">
            <BevelButton
              type="submit"
              variant="primary"
              disabled={isSubmitting || me.isPending}
            >
              <Trans>Save changes</Trans>
            </BevelButton>
          </div>
        </form>
      </div>
    </Window>
  );
}
