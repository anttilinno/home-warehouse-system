import "@testing-library/jest-dom";
import { i18n } from "@/lib/i18n";

// Activate the source locale for the whole unit-test run. main.tsx does this at
// app boot via loadCatalog(); tests don't go through that path, so components
// that read messages imperatively (useLingui().t — e.g. dynamic aria-labels and
// interpolated meta strings) would otherwise render empty under <I18nProvider>.
// `<Trans>` degrades to its source text without this, but `t` does not.
i18n.load("en", {});
i18n.activate("en");
