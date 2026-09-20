import type { AppUser } from "../../data";
import { ActivityPage } from "./ActivityPage";

export function ImporterActivityPage({ viewer, onProduct }: { viewer: AppUser; onProduct: () => void }) {
  return <ActivityPage viewer={viewer} importer onNavigate={(target) => target === "product" && onProduct()} />;
}
