"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ==========================================================================
   RetroForm Components - Form elements for retro theme

   Usage:
   <RetroForm onSubmit={handleSubmit}>
     <RetroFormGroup>
       <RetroLabel htmlFor="name" required>Name</RetroLabel>
       <RetroInput id="name" placeholder="Enter name" />
     </RetroFormGroup>

     <RetroFormGroup>
       <RetroLabel htmlFor="bio">Bio</RetroLabel>
       <RetroTextarea id="bio" placeholder="Tell us about yourself" />
     </RetroFormGroup>

     <RetroCheckbox id="agree" label="I agree to the terms" />

     <RetroFormGroup>
       <RetroLabel htmlFor="role">Role</RetroLabel>
       <RetroSelect id="role">
         <option value="">Select a role</option>
         <option value="admin">Admin</option>
         <option value="user">User</option>
       </RetroSelect>
     </RetroFormGroup>
   </RetroForm>
   ========================================================================== */

// Form container
interface RetroFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
}

export function RetroForm({ children, className, ...props }: RetroFormProps) {
  return (
    <form className={cn("retro-form", className)} {...props}>
      {children}
    </form>
  );
}

// Form group (label + input wrapper)
interface RetroFormGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function RetroFormGroup({ children, className, ...props }: RetroFormGroupProps) {
  return (
    <div className={cn("retro-form-group", className)} {...props}>
      {children}
    </div>
  );
}

// Form row (horizontal layout)
interface RetroFormRowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  cols?: 2 | 3 | 4;
}

export function RetroFormRow({ children, cols = 2, className, ...props }: RetroFormRowProps) {
  const colClasses: Record<number, string> = {
    2: "retro-form-row--2",
    3: "retro-form-row--3",
    4: "retro-form-row--4",
  };

  return (
    <div className={cn("retro-form-row", colClasses[cols], className)} {...props}>
      {children}
    </div>
  );
}

// Label
interface RetroLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
  required?: boolean;
}

export function RetroLabel({ children, required, className, ...props }: RetroLabelProps) {
  return (
    <label
      className={cn("retro-label", required && "retro-label--required", className)}
      {...props}
    >
      {children}
    </label>
  );
}

// Input
interface RetroInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  mono?: boolean;
}

export const RetroInput = React.forwardRef<HTMLInputElement, RetroInputProps>(
  ({ error, mono, disabled, className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        disabled={disabled}
        className={cn(
          "retro-input",
          error && "retro-input--error",
          mono && "retro-input--mono",
          disabled && "retro-input--disabled",
          className
        )}
        {...props}
      />
    );
  }
);
RetroInput.displayName = "RetroInput";

// Textarea
interface RetroTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  resizable?: boolean;
}

export const RetroTextarea = React.forwardRef<HTMLTextAreaElement, RetroTextareaProps>(
  ({ error, resizable, className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "retro-textarea",
          error && "retro-input--error",
          resizable && "retro-textarea--resizable",
          className
        )}
        {...props}
      />
    );
  }
);
RetroTextarea.displayName = "RetroTextarea";

// Select
interface RetroSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const RetroSelect = React.forwardRef<HTMLSelectElement, RetroSelectProps>(
  ({ error, disabled, className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        disabled={disabled}
        className={cn(
          "retro-select",
          error && "retro-input--error",
          disabled && "retro-input--disabled",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);
RetroSelect.displayName = "RetroSelect";

// Checkbox
interface RetroCheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export const RetroCheckbox = React.forwardRef<HTMLInputElement, RetroCheckboxProps>(
  ({ label, id, className, ...props }, ref) => {
    if (label) {
      return (
        <div className="retro-checkbox-group">
          <input
            ref={ref}
            type="checkbox"
            id={id}
            className={cn("retro-checkbox", className)}
            {...props}
          />
          <label htmlFor={id} className="retro-checkbox-label">
            {label}
          </label>
        </div>
      );
    }

    return (
      <input
        ref={ref}
        type="checkbox"
        id={id}
        className={cn("retro-checkbox", className)}
        {...props}
      />
    );
  }
);
RetroCheckbox.displayName = "RetroCheckbox";

// Error message
interface RetroErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export function RetroError({ children, className, ...props }: RetroErrorProps) {
  return (
    <p className={cn("retro-error", className)} {...props}>
      {children}
    </p>
  );
}

// Hint/Help text
interface RetroHintProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export function RetroHint({ children, className, ...props }: RetroHintProps) {
  return (
    <p className={cn("retro-hint", className)} {...props}>
      {children}
    </p>
  );
}

// Form divider
interface RetroFormDividerProps extends React.HTMLAttributes<HTMLDivElement> {}

export function RetroFormDivider({ className, ...props }: RetroFormDividerProps) {
  return <div className={cn("retro-form-divider", className)} {...props} />;
}
