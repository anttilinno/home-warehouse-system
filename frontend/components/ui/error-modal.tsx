"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ErrorModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  detail: string
  traceback?: string
  exceptionType?: string
}

export function ErrorModal({
  isOpen,
  onClose,
  title,
  detail,
  traceback,
  exceptionType,
}: ErrorModalProps) {
  // Close on escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = ""
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className={cn(
          "relative z-10 w-full max-w-3xl max-h-[90vh] m-4",
          "bg-background border border-destructive rounded-lg shadow-xl",
          "flex flex-col overflow-hidden"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-destructive bg-destructive/10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">&#9888;</span>
            <h2 className="text-lg font-semibold text-destructive">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-destructive/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Exception Type */}
          {exceptionType && (
            <div className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded inline-block text-sm font-mono">
              {exceptionType}
            </div>
          )}

          {/* Detail */}
          <div className="text-foreground">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Error Message</h3>
            <p className="text-base">{detail}</p>
          </div>

          {/* Traceback */}
          {traceback && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Stack Trace</h3>
              <pre className="p-4 bg-zinc-900 text-zinc-100 rounded-md text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">
                {traceback}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// Global error state for showing errors from anywhere
interface ServerError {
  detail: string
  traceback?: string
  exception_type?: string
  error_type?: string
}

interface ErrorContextValue {
  showError: (error: ServerError) => void
  clearError: () => void
}

const ErrorContext = React.createContext<ErrorContextValue | null>(null)

export function ErrorProvider({ children }: { children: React.ReactNode }) {
  const [error, setError] = React.useState<ServerError | null>(null)

  const showError = React.useCallback((err: ServerError) => {
    setError(err)
  }, [])

  const clearError = React.useCallback(() => {
    setError(null)
  }, [])

  // Register with API client on mount
  React.useEffect(() => {
    import("@/lib/api").then(({ setApiErrorHandler }) => {
      setApiErrorHandler(showError)
    })
  }, [showError])

  return (
    <ErrorContext.Provider value={{ showError, clearError }}>
      {children}
      <ErrorModal
        isOpen={error !== null}
        onClose={clearError}
        title="Server Error (500)"
        detail={error?.detail || "An unexpected error occurred"}
        traceback={error?.traceback}
        exceptionType={error?.exception_type}
      />
    </ErrorContext.Provider>
  )
}

export function useErrorModal() {
  const context = React.useContext(ErrorContext)
  if (!context) {
    throw new Error("useErrorModal must be used within an ErrorProvider")
  }
  return context
}

// Global accessor for showing errors from non-React code (like API client)
let globalShowError: ((error: ServerError) => void) | null = null

export function setGlobalErrorHandler(handler: (error: ServerError) => void) {
  globalShowError = handler
}

export function showGlobalError(error: ServerError) {
  if (globalShowError) {
    globalShowError(error)
  } else {
    console.error("Error modal not initialized:", error)
  }
}
