import { useState, useRef } from "react";
import {
  RetroButton,
  RetroPanel,
  RetroInput,
  RetroCard,
  RetroDialog,
  RetroTable,
  RetroTabs,
  RetroBadge,
  HazardStripe,
  ToastProvider,
  useToast,
} from "@/components/retro";
import type { RetroDialogHandle } from "@/components/retro";

function DemoContent() {
  const { addToast } = useToast();
  const dialogRef = useRef<RetroDialogHandle>(null);
  const [activeTab, setActiveTab] = useState("alpha");
  const [inputValue, setInputValue] = useState("");

  const tableColumns = [
    { key: "id", header: "ID" },
    { key: "name", header: "DESIGNATION" },
    { key: "status", header: "STATUS" },
    { key: "sector", header: "SECTOR" },
  ];

  const tableData = [
    {
      id: "001",
      name: "WRENCH SET",
      status: <RetroBadge variant="success">ACTIVE</RetroBadge>,
      sector: "A-7",
    },
    {
      id: "002",
      name: "DRILL PRESS",
      status: <RetroBadge variant="warning">WARNING</RetroBadge>,
      sector: "B-3",
    },
    {
      id: "003",
      name: "SAFETY HARNESS",
      status: <RetroBadge variant="danger">CRITICAL</RetroBadge>,
      sector: "C-1",
    },
  ];

  return (
    <div className="min-h-dvh bg-retro-charcoal p-xl">
      <div className="max-w-[960px] mx-auto">
        {/* Page header */}
        <h1 className="text-[28px] font-bold uppercase text-retro-cream mb-xs">
          RETRO COMPONENT LIBRARY
        </h1>
        <p className="text-retro-green font-mono text-[14px] mb-2xl">
          SYSTEM STATUS: ALL COMPONENTS OPERATIONAL
        </p>

        {/* 1. RETROBUTTON */}
        <section className="mb-2xl">
          <h2 className="text-[20px] font-bold uppercase text-retro-cream mb-sm">
            RETROBUTTON
          </h2>
          <HazardStripe className="mb-md" />
          <div className="flex gap-md flex-wrap mb-md">
            <RetroButton variant="primary">EXECUTE</RetroButton>
            <RetroButton variant="danger">ABORT MISSION</RetroButton>
            <RetroButton variant="neutral">STANDBY</RetroButton>
          </div>
          <div className="flex gap-md flex-wrap">
            <RetroButton disabled>DISABLED</RetroButton>
          </div>
        </section>

        {/* 2. RETROPANEL */}
        <section className="mb-2xl">
          <h2 className="text-[20px] font-bold uppercase text-retro-cream mb-sm">
            RETROPANEL
          </h2>
          <HazardStripe className="mb-md" />
          <div className="flex flex-col gap-md">
            <RetroPanel
              title="SYSTEM PANEL"
              showHazardStripe
              showClose
              onClose={() => {}}
            >
              <p className="text-[14px] text-retro-ink">
                This panel includes a hazard stripe header, a title, and a
                decorative close button. All systems nominal.
              </p>
            </RetroPanel>
            <RetroPanel>
              <p className="text-[14px] text-retro-ink">
                A minimal panel without hazard stripe or close button. Used for
                simple content grouping.
              </p>
            </RetroPanel>
          </div>
        </section>

        {/* 3. RETROINPUT */}
        <section className="mb-2xl">
          <h2 className="text-[20px] font-bold uppercase text-retro-cream mb-sm">
            RETROINPUT
          </h2>
          <HazardStripe className="mb-md" />
          <div className="flex flex-col gap-md max-w-[400px]">
            <RetroInput
              placeholder="ENTER DESIGNATION..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              icon={
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                >
                  <rect
                    x="2"
                    y="4"
                    width="16"
                    height="12"
                    rx="1"
                    stroke="#1A1A1A"
                    strokeWidth="1.5"
                    fill="none"
                  />
                  <path
                    d="M2 5l8 5 8-5"
                    stroke="#1A1A1A"
                    strokeWidth="1.5"
                    fill="none"
                  />
                </svg>
              }
            />
            <RetroInput
              placeholder="ENTER DESIGNATION..."
              error="INVALID INPUT DETECTED"
            />
            <RetroInput placeholder="DISABLED" disabled />
          </div>
        </section>

        {/* 4. RETROCARD */}
        <section className="mb-2xl">
          <h2 className="text-[20px] font-bold uppercase text-retro-cream mb-sm">
            RETROCARD
          </h2>
          <HazardStripe className="mb-md" />
          <RetroCard>
            <p className="text-[14px] text-retro-ink mb-sm">
              RetroCard is a lightweight content container with thick borders and
              raised shadow. It has smaller padding than RetroPanel and no close
              button or hazard stripe.
            </p>
            <p className="text-[14px] text-retro-ink">
              Use it for grouping content inside panels or as standalone
              lightweight containers.
            </p>
          </RetroCard>
        </section>

        {/* 5. RETRODIALOG */}
        <section className="mb-2xl">
          <h2 className="text-[20px] font-bold uppercase text-retro-cream mb-sm">
            RETRODIALOG
          </h2>
          <HazardStripe className="mb-md" />
          <RetroButton onClick={() => dialogRef.current?.open()}>
            OPEN DIALOG
          </RetroButton>
          <RetroDialog ref={dialogRef}>
            <h3 className="text-[20px] font-bold uppercase text-retro-ink mb-md">
              CONFIRM ACTION
            </h3>
            <p className="text-[14px] text-retro-ink mb-lg">
              Are you sure you want to proceed with this operation?
            </p>
            <div className="flex gap-md">
              <RetroButton
                variant="primary"
                onClick={() => dialogRef.current?.close()}
              >
                CONFIRM
              </RetroButton>
              <RetroButton onClick={() => dialogRef.current?.close()}>
                ABORT
              </RetroButton>
            </div>
          </RetroDialog>
        </section>

        {/* 6. RETROTABLE */}
        <section className="mb-2xl">
          <h2 className="text-[20px] font-bold uppercase text-retro-cream mb-sm">
            RETROTABLE
          </h2>
          <HazardStripe className="mb-md" />
          <RetroTable columns={tableColumns} data={tableData} />
          <p className="text-retro-gray text-[14px] mt-md font-mono">
            NO DATA LOADED
          </p>
        </section>

        {/* 7. RETROTABS */}
        <section className="mb-2xl">
          <h2 className="text-[20px] font-bold uppercase text-retro-cream mb-sm">
            RETROTABS
          </h2>
          <HazardStripe className="mb-md" />
          <RetroTabs
            tabs={[
              { key: "alpha", label: "ALPHA" },
              { key: "bravo", label: "BRAVO" },
              { key: "charlie", label: "CHARLIE" },
            ]}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          <RetroPanel>
            <p className="text-[14px] text-retro-ink font-mono">
              ACTIVE SECTOR: {activeTab.toUpperCase()}
            </p>
          </RetroPanel>
        </section>

        {/* 8. RETROTOAST */}
        <section className="mb-2xl">
          <h2 className="text-[20px] font-bold uppercase text-retro-cream mb-sm">
            RETROTOAST
          </h2>
          <HazardStripe className="mb-md" />
          <div className="flex gap-md flex-wrap">
            <RetroButton
              variant="primary"
              onClick={() => addToast("OPERATION COMPLETE", "success")}
            >
              SUCCESS TOAST
            </RetroButton>
            <RetroButton
              variant="danger"
              onClick={() => addToast("SYSTEM ERROR DETECTED", "error")}
            >
              ERROR TOAST
            </RetroButton>
            <RetroButton
              variant="neutral"
              onClick={() => addToast("NEW TRANSMISSION RECEIVED", "info")}
            >
              INFO TOAST
            </RetroButton>
          </div>
        </section>

        {/* 9. RETROBADGE */}
        <section className="mb-2xl">
          <h2 className="text-[20px] font-bold uppercase text-retro-cream mb-sm">
            RETROBADGE
          </h2>
          <HazardStripe className="mb-md" />
          <div className="flex gap-sm flex-wrap">
            <RetroBadge variant="success">ACTIVE</RetroBadge>
            <RetroBadge variant="neutral">OFFLINE</RetroBadge>
            <RetroBadge variant="warning">WARNING</RetroBadge>
            <RetroBadge variant="danger">CRITICAL</RetroBadge>
            <RetroBadge variant="info">NOMINAL</RetroBadge>
          </div>
        </section>

        {/* 10. HAZARDSTRIPE */}
        <section className="mb-2xl">
          <h2 className="text-[20px] font-bold uppercase text-retro-cream mb-sm">
            HAZARDSTRIPE
          </h2>
          <HazardStripe className="mb-md" />
          <div className="flex flex-col gap-md">
            <HazardStripe />
            <HazardStripe height={16} />
            <HazardStripe height={32} />
          </div>
        </section>
      </div>
    </div>
  );
}

export function DemoPage() {
  return (
    <ToastProvider>
      <DemoContent />
    </ToastProvider>
  );
}
