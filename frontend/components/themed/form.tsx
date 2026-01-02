"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ==========================================================================
   Unified Form Components - Pure CSS theming
   ========================================================================== */

// Form container
export interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
}

export function Form({ children, className, ...props }: FormProps) {
  return (
    <form className={cn("themed-form", className)} {...props}>
      {children}
    </form>
  );
}

// Form group (label + input wrapper)
export interface FormGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function FormGroup({ children, className, ...props }: FormGroupProps) {
  return (
    <div className={cn("themed-form-group", className)} {...props}>
      {children}
    </div>
  );
}

// Form row (horizontal layout)
export interface FormRowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  cols?: 2 | 3 | 4;
}

const colClasses: Record<number, string> = {
  2: "themed-form-row--2",
  3: "themed-form-row--3",
  4: "themed-form-row--4",
};

export function FormRow({ children, cols = 2, className, ...props }: FormRowProps) {
  return (
    <div className={cn("themed-form-row", colClasses[cols], className)} {...props}>
      {children}
    </div>
  );
}

// Label
export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
  required?: boolean;
}

export function Label({ children, required, className, ...props }: LabelProps) {
  return (
    <label className={cn("themed-label", required && "themed-label--required", className)} {...props}>
      {children}
      {required && <span className="themed-label__required">*</span>}
    </label>
  );
}

// Input
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  mono?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error, mono, disabled, className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        disabled={disabled}
        className={cn(
          "themed-input",
          error && "themed-input--error",
          mono && "themed-input--mono",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

// Textarea
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  resizable?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, resizable, className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "themed-textarea",
          error && "themed-textarea--error",
          resizable && "themed-textarea--resizable",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

// Select
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, disabled, className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        disabled={disabled}
        className={cn("themed-select", error && "themed-select--error", className)}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = "Select";

// Checkbox
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, id, className, ...props }, ref) => {
    if (label) {
      return (
        <div className="themed-checkbox-wrapper">
          <input
            ref={ref}
            type="checkbox"
            id={id}
            className={cn("themed-checkbox", className)}
            {...props}
          />
          <label htmlFor={id} className="themed-checkbox-label">
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
        className={cn("themed-checkbox", className)}
        {...props}
      />
    );
  }
);
Checkbox.displayName = "Checkbox";

// Error message
export interface ErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export function Error({ children, className, ...props }: ErrorProps) {
  return (
    <p className={cn("themed-error", className)} {...props}>
      {children}
    </p>
  );
}

// Hint/Help text
export interface HintProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export function Hint({ children, className, ...props }: HintProps) {
  return (
    <p className={cn("themed-hint", className)} {...props}>
      {children}
    </p>
  );
}

// Form divider
export interface FormDividerProps extends React.HTMLAttributes<HTMLDivElement> {}

export function FormDivider({ className, ...props }: FormDividerProps) {
  return <div className={cn("themed-form-divider", className)} {...props} />;
}
